"""Generate the browser-only edition from the current Studio HTML."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def replace_once(source, old, new):
    if source.count(old) != 1:
        raise ValueError(f"Expected one edition marker: {old!r}")
    return source.replace(old, new, 1)


def remove_section(source, start, end):
    first = source.index(start)
    last = source.index(end, first)
    return source[:first] + source[last:]


def main():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    version = re.search(r'const APP_VERSION = "([^"]+)";', html).group(1)
    html = replace_once(html, "<title>Echem Plot Studio</title>",
                        "<title>Echem Plot Studio · Browser Edition</title>")
    html = replace_once(html, 'accept=".ndax,.mpr,.mpt,.csv,.txt,.xlsx,.xls"',
                        'accept=".mpt,.csv,.txt,.xlsx,.xls"')
    html = html.replace(".ndax / .mpr / .mpt / .csv", ".mpt / .csv")
    html = html.replace('accept=".mpr,.mpt,.csv,.txt,.xlsx,.xls"', 'accept=".mpt,.csv,.txt,.xlsx,.xls"')
    html = html.replace("upload .csv / .xlsx / .xls", "upload .csv / .txt / .xlsx / .xls")
    html = html.replace("上傳 .csv / .xlsx / .xls", "上傳 .csv / .txt / .xlsx / .xls")
    html = html.replace("上传 .csv / .xlsx / .xls", "上传 .csv / .txt / .xlsx / .xls")
    html = re.sub(r'^.*id="ndaxMassG".*\n', "", html, flags=re.M)
    html = remove_section(
        html,
        '      <section class="instr-section">\n        <h3 data-i18n="instr_s2_title">',
        '      <section class="instr-section">\n        <h3 data-i18n="instr_s3_title">',
    )
    html = re.sub(r'^    (?:status_ndax_\w+|alert_ndax_\w+|instr_s2_\w+):.*\n',
                  "", html, flags=re.M)
    html = remove_section(html, '  if(name.endsWith(".ndax")){',
                          '  } else if(/\\.mp[rt]$/.test(name)){')
    html = replace_once(html, '  } else if(/\\.mp[rt]$/.test(name)){',
                        '  if(/\\.mpt$/.test(name)){')
    html = html.replace('if(/\\.mp[rt]$/.test(name)){', 'if(/\\.mpt$/.test(name)){')
    html = remove_section(html, "  async function exportOrigin(page,status){",
                          "  function addButton(container,page,prepend=false){")
    html = remove_section(html, "    const origin=document.createElement('button');",
                          "    bar.append(format,headerLabel,button,origin,status);")
    html = replace_once(html, "bar.append(format,headerLabel,button,origin,status)",
                        "bar.append(format,headerLabel,button,status)")
    html = re.sub(r"^.*querySelectorAll\('\[data-origin-export\]'\).*\n", "", html, flags=re.M)
    html = replace_once(html, "copyTable,originPayload,exportOrigin};",
                        "copyTable,originPayload};")
    for hint in (", or export OPJU to set them automatically",
                 "；匯出 OPJU 會自動指定", "；导出 OPJU 会自动指定"):
        html = html.replace(hint, "")
    license_text = (ROOT / "LICENSE").read_text(encoding="utf-8")
    html = replace_once(html, "<!DOCTYPE html>\n",
                        f"<!DOCTYPE html>\n<!--\n{license_text}\n-->\n")
    output = ROOT / "downloads" / f"Echem_Plot_Studio_v{version}_Browser.html"
    output.parent.mkdir(exist_ok=True)
    output.write_text(html, encoding="utf-8", newline="\n")
    print(output)


if __name__ == "__main__":
    main()
