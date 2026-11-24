from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "Documento_Tecnico_BibliotecaAlameda.md"
OUTPUT = ROOT / "Documento_Tecnico_BibliotecaAlameda.docx"


def add_page_number(paragraph):
    run = paragraph.add_run()
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = "PAGE"
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char1)
    run._r.append(instr_text)
    run._r.append(fld_char2)


def set_cell_shading(cell, color):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), color)
    tc_pr.append(shd)


document = Document()
section = document.sections[0]
section.top_margin = Inches(0.75)
section.bottom_margin = Inches(0.75)
section.left_margin = Inches(0.85)
section.right_margin = Inches(0.85)

styles = document.styles
styles["Normal"].font.name = "Aptos"
styles["Normal"].font.size = Pt(11)
styles["Title"].font.name = "Aptos Display"
styles["Title"].font.size = Pt(28)
styles["Title"].font.bold = True
styles["Title"].font.color.rgb = RGBColor(147, 59, 91)

for name, size, color in [
    ("Heading 1", 18, "933B5B"),
    ("Heading 2", 14, "30272B"),
    ("Heading 3", 12, "9F9679"),
]:
    style = styles[name]
    style.font.name = "Aptos"
    style.font.size = Pt(size)
    style.font.bold = True
    style.font.color.rgb = RGBColor.from_string(color)
    style.paragraph_format.space_before = Pt(10)
    style.paragraph_format.space_after = Pt(5)

header = section.header.paragraphs[0]
header.text = "Biblioteca Alameda - Documento técnico"
header.alignment = WD_ALIGN_PARAGRAPH.RIGHT

footer = section.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_page_number(footer)

title = document.add_paragraph()
title.style = styles["Title"]
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
title.add_run("Proyecto Final\nBiblioteca Alameda")

subtitle = document.add_paragraph()
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
subtitle.add_run("MongoDB • Apollo GraphQL • Node.js • Render").bold = True

document.add_paragraph()

team_table = document.add_table(rows=4, cols=2)
team_table.alignment = WD_TABLE_ALIGNMENT.CENTER
team_table.style = "Table Grid"
team_rows = [
    ("Integrantes", "Karla Natalia Jara Álvarez\nFrancisco Javier Bustamante Miramontes\nSaúl Esparza Guevara"),
    ("Base de datos", "MongoDB Atlas"),
    ("Base", "biblioteca_alameda"),
    ("Despliegue", "https://biblioteca-k76i.onrender.com"),
]
for row, values in zip(team_table.rows, team_rows):
    row.cells[0].text = values[0]
    row.cells[1].text = values[1]
    set_cell_shading(row.cells[0], "E3D6BF")
    for cell in row.cells:
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.name = "Aptos"

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
            cell = table.cell(0, 0)
            set_cell_shading(cell, "F4EFE5")
            paragraph = cell.paragraphs[0]
            run = paragraph.add_run(text)
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
        text = heading.group(2)
        document.add_heading(text, level=min(level, 3))
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
