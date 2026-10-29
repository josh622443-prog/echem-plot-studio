using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using BTSDALib;
using Newtonsoft.Json;

internal static class NdaxJsonExtractor
{
    private static string BtsdaDirectory;
    private sealed class PointData { public double TimeH, Voltage, Current, CapacityAh, EnergyWh, CapC; public uint Cycle; }
    private static double MassG {
        get { double v; return double.TryParse(Environment.GetEnvironmentVariable("NDAX_MASS_G"), NumberStyles.Float, CultureInfo.InvariantCulture, out v) && v > 0 ? v : 0.04563; }
    }
    private static Dictionary<string, object> Row(params object[] pairs) {
        var d = new Dictionary<string, object>(); for (int i = 0; i < pairs.Length; i += 2) d[(string)pairs[i]] = pairs[i + 1]; return d;
    }
    private static double Voltage(dynamic v) { double x = Convert.ToDouble(v, CultureInfo.InvariantCulture); return Math.Abs(x) > 100 ? x / 10000.0 : x; }
    private static List<PointData> Sample(List<PointData> src, int max) {
        if (src.Count <= max) return src; int stride = (int)Math.Ceiling(src.Count / (double)max); var o = new List<PointData>();
        for (int i = 0; i < src.Count; i += stride) o.Add(src[i]); if (o[o.Count - 1] != src[src.Count - 1]) o.Add(src[src.Count - 1]); return o;
    }

    public static int Main(string[] args)
    {
        BtsdaDirectory = FindBtsdaDirectory();
        if (BtsdaDirectory == null) {
            Console.Error.WriteLine("NEWARE BTSDA libraries were not found. Install BTSClient80 or set NEWARE_BTSDA_DIR to the folder containing BTSDALib.dll.");
            return 3;
        }
        AppDomain.CurrentDomain.AssemblyResolve += delegate(object sender, ResolveEventArgs e) {
            string p = Path.Combine(BtsdaDirectory, new AssemblyName(e.Name).Name + ".dll"); return File.Exists(p) ? Assembly.LoadFrom(p) : null;
        };
        return Run(args);
    }

    private static string FindBtsdaDirectory()
    {
        var candidates = new List<string>();
        string configured = Environment.GetEnvironmentVariable("NEWARE_BTSDA_DIR");
        if (!String.IsNullOrWhiteSpace(configured)) candidates.Add(configured.Trim().Trim('"'));
        foreach (var root in new[] { Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles) }) {
            if (!String.IsNullOrWhiteSpace(root)) {
                candidates.Add(Path.Combine(root, "NEWARE", "BTSClient80"));
                candidates.Add(Path.Combine(root, "NEWARE", "BTSClient"));
            }
        }
        return candidates.FirstOrDefault(p => Directory.Exists(p) && File.Exists(Path.Combine(p, "BTSDALib.dll")) && File.Exists(Path.Combine(p, "Common.dll")));
    }

    // Kept separate so the CLR installs AssemblyResolve before it JIT-compiles
    // code that refers to NEWARE's assemblies.
    private static int Run(string[] args)
    {
        if (args.Length != 2) { Console.Error.WriteLine("Usage: NdaxJsonExtractor input.ndax output.json"); return 2; }
        string temp = Path.Combine(Path.GetTempPath(), "ndax-api-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(temp);
        try {
            ZipFile.ExtractToDirectory(args[0], temp); string ndc = Path.Combine(temp, "data.ndc");
            var loader = new BTSData(ndc); dynamic file = loader.OpenNdcFile(ndc, null, null);
            if (file == null || !file.IsOpened) throw new InvalidOperationException("NEWARE reader could not open data.ndc");
            uint count = file.DataCount((long)0, (uint)0); var byCycle = new Dictionary<uint, List<PointData>>();
            for (uint i = 1; i <= count; i++) {
                file.Seek((long)0, i); if (!file.IsOK()) continue; uint cyc = file.CycleID(); if (cyc == 0) continue;
                List<PointData> list; if (!byCycle.TryGetValue(cyc, out list)) byCycle[cyc] = list = new List<PointData>();
                double capC = Convert.ToDouble(file.CapF());
                list.Add(new PointData { Cycle = cyc, TimeH = Convert.ToDouble(file.TotalTime()) / 3600000.0, Voltage = Convert.ToDouble(file.VoltF()) / 10000.0, Current = Convert.ToDouble(file.CurrF()) / 1000.0, CapacityAh = capC / 3600000.0, EnergyWh = Convert.ToDouble(file.EngF()) / 3600000.0, CapC = capC });
            }

            dynamic cnd = Activator.CreateInstance(file.GetType().GetNestedType("CycleStatisticsCnd")); dynamic cycles = file.CycleStatisticsEx(cnd);
            var cycleRows = new List<Dictionary<string, object>>(); var ceRows = new List<Dictionary<string, object>>(); double firstD = 0;
            foreach (dynamic cp in cycles) {
                double ca = Convert.ToDouble(cp.CCap) / 3600000.0, da = Convert.ToDouble(cp.DCap) / 3600000.0;
                double ce = Convert.ToDouble(cp.CEng) / 3600000.0, de = Convert.ToDouble(cp.DEng) / 3600000.0; if (firstD == 0 && da > 0) firstD = da;
                double eff = ca == 0 ? 0 : da / ca * 100.0, retention = firstD == 0 ? 0 : da / firstD * 100.0;
                var r = Row("Cycle Index", Convert.ToDouble(cp.CycleID), "Charge Capacity (Ah)", ca, "Discharge Capacity (Ah)", da,
                    "Charge Specific Capacity (mAh/g)", ca * 1000.0 / MassG, "Discharge Specific Capacity (mAh/g)", da * 1000.0 / MassG,
                    "Coulombic Efficiency (%)", eff, "Capacity Retention (%)", retention, "Charge Energy (Wh)", ce, "Discharge Energy (Wh)", de,
                    "Average Charge Voltage (V)", Voltage(cp.ChgAvgVolt), "Average Discharge Voltage (V)", Voltage(cp.DisAvgVolt));
                cycleRows.Add(r); ceRows.Add(Row("Cycle Index", Convert.ToDouble(cp.CycleID), "Discharge Specific Capacity (mAh/g)", da * 1000.0 / MassG, "Charge Specific Capacity (mAh/g)", ca * 1000.0 / MassG, "Coulombic Efficiency (%)", eff));
            }

            var recordRows = new List<Dictionary<string, object>>(); var qvRows = new List<Dictionary<string, object>>(); var dqdvRows = new List<Dictionary<string, object>>();
            foreach (var kv in byCycle.OrderBy(x => x.Key)) {
                var sampled = Sample(kv.Value, 1500);
                foreach (var p in sampled) {
                    recordRows.Add(Row("Cycle Index", (double)p.Cycle, "Total Time (h)", p.TimeH, "Voltage (V)", p.Voltage, "Current (A)", p.Current, "Capacity (Ah)", p.CapacityAh, "Specific Capacity (mAh/g)", p.CapC / 3600.0 / MassG, "Energy (Wh)", p.EnergyWh));
                    qvRows.Add(Row("Cycle Index", (double)p.Cycle, "Specific Capacity (mAh/g)", p.CapC / 3600.0 / MassG, "Voltage (V)", p.Voltage));
                }
                var a = kv.Value; int anchor = 0; int emitted = 0;
                for (int i = 1; i < a.Count && emitted < 1500; i++) {
                    if (Math.Abs(a[i].Voltage - a[anchor].Voltage) < 0.005) continue; double dv = a[i].Voltage - a[anchor].Voltage;
                    double deriv = (a[i].CapC - a[anchor].CapC) / 3600.0 / dv;
                    if (!double.IsNaN(deriv) && !double.IsInfinity(deriv)) { dqdvRows.Add(Row("Cycle Index", (double)kv.Key, "Voltage (V)", a[i].Voltage, "dQ/dV (mAh/V)", deriv)); emitted++; }
                    anchor = i;
                }
            }
            file.CloseFile();
            var sheets = new Dictionary<string, object>();
            sheets["Cycle"] = new { headers = cycleRows.Count > 0 ? cycleRows[0].Keys.ToArray() : new string[0], rows = cycleRows };
            sheets["Record"] = new { headers = new[] { "Cycle Index", "Total Time (h)", "Voltage (V)", "Current (A)", "Capacity (Ah)", "Specific Capacity (mAh/g)", "Energy (Wh)" }, rows = recordRows };
            sheets["QV"] = new { headers = new[] { "Cycle Index", "Specific Capacity (mAh/g)", "Voltage (V)" }, rows = qvRows };
            sheets["CE"] = new { headers = ceRows.Count > 0 ? ceRows[0].Keys.ToArray() : new string[0], rows = ceRows };
            sheets["dQdV"] = new { headers = new[] { "Cycle Index", "Voltage (V)", "dQ/dV (mAh/V)" }, rows = dqdvRows };
            var result = new { fileName = Path.GetFileName(args[0]), massG = MassG, sourceRecords = count, sheetNames = new[] { "Cycle", "Record", "QV", "CE", "dQdV" }, sheets = sheets };
            File.WriteAllText(args[1], JsonConvert.SerializeObject(result, Formatting.None)); return 0;
        } catch (Exception ex) { Console.Error.WriteLine(ex); return 1; }
        finally { try { if (Directory.Exists(temp)) Directory.Delete(temp, true); } catch { } }
    }
}
