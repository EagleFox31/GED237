
import zipfile
import xml.etree.ElementTree as ET
import sys
import os

def extract_text_from_docx(docx_path):
    try:
        with zipfile.ZipFile(docx_path) as docx:
            if 'word/document.xml' not in docx.namelist():
                return f"[ERROR: word/document.xml not found in {os.path.basename(docx_path)}]"

            xml_content = docx.read('word/document.xml')
            tree = ET.fromstring(xml_content)

            namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

            text_parts = []
            for node in tree.iter():
                if node.tag.endswith('}t'):
                    if node.text:
                        text_parts.append(node.text)
                elif node.tag.endswith('}p'):
                    text_parts.append('\n')

            return ''.join(text_parts)

    except Exception as e:
        return f"[ERROR extracting {os.path.basename(docx_path)}: {e}]"

def main():
    target_dir = "Phase de Conception"
    if len(sys.argv) > 1:
        target_dir = sys.argv[1]

    output_file = "design_docs_content.txt"

    with open(output_file, "w", encoding="utf-8") as out:
        if os.path.exists(target_dir):
            for root, dirs, files in os.walk(target_dir):
                for filename in files:
                    if filename.endswith(".docx") and not filename.startswith("~$"):
                        file_path = os.path.join(root, filename)
                        print(f"Processing {file_path}...")
                        out.write(f"\n\n{'='*50}\nFILE: {filename}\n{'='*50}\n\n")
                        content = extract_text_from_docx(file_path)
                        out.write(content)
        else:
            out.write(f"Directory not found: {target_dir}")
            print(f"Directory not found: {target_dir}")

if __name__ == "__main__":
    main()
