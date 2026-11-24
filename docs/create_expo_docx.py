from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "Guia_Exposicion_Testeo_BibliotecaAlameda.md"
OUTPUT = ROOT / "Guia_Exposicion_Testeo_BibliotecaAlameda.docx"


def add_page_number(paragraph):
    run = paragraph.add_run()
    fld1 = OxmlElement("w:fldChar")
    fld1.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = "PAGE"
    fld2 = OxmlElement("w:fldChar")
    fld2.set(qn("w:fldCharType"), "end")
    run._r.append(fld1)
    run._r.append(instr)
    run._r.append(fld2)


def shade(cell, color):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), color)
    tc_pr.append(shd)


document = Document()
section = document.sections[0]
section.top_margin = Inches(0.7)
section.bottom_margin = Inches(0.7)
section.left_margin = Inches(0.8)
section.right_margin = Inches(0.8)

normal = document.styles["Normal"]
normal.font.name = "Aptos"
normal.font.size = Pt(11)

title_style = document.styles["Title"]
title_style.font.name = "Aptos Display"
title_style.font.size = Pt(26)
title_style.font.bold = True
title_style.font.color.rgb = RGBColor(147, 59, 91)

for name, size, color in [
    ("Heading 1", 18, "933B5B"),
    ("Heading 2", 14, "30272B"),
    ("Heading 3", 12, "9F9679"),
]:
    style = document.styles[name]
    style.font.name = "Aptos"
    style.font.size = Pt(size)
    style.font.bold = True
    style.font.color.rgb = RGBColor.from_string(color)
    style.paragraph_format.space_before = Pt(9)
    style.paragraph_format.space_after = Pt(4)

header = section.header.paragraphs[0]
header.text = "Biblioteca Alameda - Guía de exposición y testeo"
header.alignment = WD_ALIGN_PARAGRAPH.RIGHT

footer = section.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_page_number(footer)

title = document.add_paragraph()
title.style = document.styles["Title"]
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
title.add_run("Guía de exposición y testeo\nBiblioteca Alameda")

subtitle = document.add_paragraph()
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = subtitle.add_run("Guion de presentación • Demostración • Testeo")
run.bold = True
run.font.color.rgb = RGBColor(159, 150, 121)

document.add_paragraph()

team = document.add_table(rows=1, cols=3)
team.alignment = WD_TABLE_ALIGNMENT.CENTER
team.style = "Table Grid"
names = [
    "Karla Natalia Jara Álvarez",
    "Francisco Javier Bustamante Miramontes",
    "Saúl Esparza Guevara",
]
for cell, name in zip(team.rows[0].cells, names):
    cell.text = name
    shade(cell, "E3D6BF")
    for paragraph in cell.paragraphs:
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in paragraph.runs:
            run.font.name = "Aptos"
            run.font.bold = True

document.add_page_break()

lines = SOURCE.read_text(encoding="utf-8").splitlines()
in_code = False
code_lines = []

for line in lines:
    if line.startswith("```"):
        if in_code:
            text = "\n".join(code_lines).rstrip()
            table = document.add_table(rows=1, cols=1)
            table.style = "Table Grid"
            shade(table.cell(0, 0), "F4EFE5")
            run = table.cell(0, 0).paragraphs[0].add_run(text)
            run.font.name = "Consolas"
            run.font.size = Pt(9)
            code_lines = []
            in_code = False
        else:
            in_code = True
        continue

    if in_code:
        code_lines.append(line)
        continue

    if not line.strip():
        document.add_paragraph()
        continue

    heading = re.match(r"^(#{1,3})\s+(.*)$", line)
    if heading:
        level = len(heading.group(1))
        document.add_heading(heading.group(2), level=min(level, 3))
        continue

    bullet = re.match(r"^[-*]\s+(.*)$", line)
    if bullet:
        document.add_paragraph(bullet.group(1), style="List Bullet")
        continue

    numbered = re.match(r"^(\d+)\.\s+(.*)$", line)
    if numbered:
        document.add_paragraph(numbered.group(2), style="List Number")
        continue

    document.add_paragraph(line)

document.save(OUTPUT)
print(OUTPUT)
