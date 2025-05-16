from flask import Flask, render_template, request, send_file
import os
import zipfile
import fitz  # PyMuPDF for PDF to JPG
from werkzeug.utils import secure_filename
from PyPDF2 import PdfReader, PdfWriter
from pdf2docx import Converter
from PIL import Image

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'converted'

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/jpg-to-pdf')
def jpg_to_pdf_page():
    return render_template('jpg_to_pdf.html')


@app.route('/pdf-to-jpg')
def pdf_to_jpg_page():
    return render_template('pdf_to_jpg.html')


@app.route('/docx-to-pdf')
def docx_to_pdf_page():
    return render_template('docx_to_pdf.html')


@app.route('/pdf-to-docx')
def pdf_to_docx_page():
    return render_template('pdf_to_docx.html')


@app.route('/compress-pdf')
def compress_pdf_page():
    return render_template('compress_pdf.html')


@app.route('/convert/jpg-to-pdf', methods=['POST'])
def convert_jpg_to_pdf():
    uploaded_files = request.files.getlist("files")
    image_list = []

    for file in uploaded_files:
        img = Image.open(file).convert("RGB")
        image_list.append(img)

    output_path = os.path.join(app.config['OUTPUT_FOLDER'], 'output.pdf')
    if image_list:
        image_list[0].save(output_path, save_all=True, append_images=image_list[1:])

    return send_file(output_path, as_attachment=True)


@app.route('/convert/pdf-to-jpg', methods=['POST'])
def convert_pdf_to_jpg():
    pdf_file = request.files['file']
    pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(pdf_file.filename))
    pdf_file.save(pdf_path)

    doc = fitz.open(pdf_path)
    img_paths = []

    for i in range(len(doc)):
        page = doc.load_page(i)
        pix = page.get_pixmap()
        img_path = os.path.join(app.config['OUTPUT_FOLDER'], f"page_{i + 1}.jpg")
        pix.save(img_path)
        img_paths.append(img_path)

    zip_path = os.path.join(app.config['OUTPUT_FOLDER'], 'images.zip')
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        for img in img_paths:
            zipf.write(img, os.path.basename(img))

    return send_file(zip_path, as_attachment=True)


@app.route('/convert/docx-to-pdf', methods=['POST'])
def convert_docx_to_pdf():
    docx_file = request.files['file']
    filename = secure_filename(docx_file.filename)
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    docx_file.save(input_path)

    # Run LibreOffice conversion
    os.system(f'soffice --headless --convert-to pdf --outdir "{app.config["OUTPUT_FOLDER"]}" "{input_path}"')

    # Find the converted file dynamically
    base_filename = os.path.splitext(filename)[0]
    output_file = os.path.join(app.config['OUTPUT_FOLDER'], f"{base_filename}.pdf")

    if os.path.exists(output_file):
        return send_file(output_file, as_attachment=True)
    else:
        return "Conversion failed. Make sure LibreOffice is installed and on the PATH.", 500


@app.route('/convert/pdf-to-docx', methods=['POST'])
def convert_pdf_to_docx():
    pdf_file = request.files['file']
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(pdf_file.filename))
    pdf_file.save(input_path)

    output_path = os.path.join(app.config['OUTPUT_FOLDER'], 'output.docx')
    cv = Converter(input_path)
    cv.convert(output_path, start=0, end=None)
    cv.close()

    return send_file(output_path, as_attachment=True)


@app.route('/convert/compress-pdf', methods=['POST'])
def compress_pdf():
    uploaded_file = request.files['file']
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(uploaded_file.filename))
    uploaded_file.save(input_path)

    reader = PdfReader(input_path)
    writer = PdfWriter()

    for page in reader.pages:
        writer.add_page(page)

    output_path = os.path.join(app.config['OUTPUT_FOLDER'], 'compressed.pdf')
    with open(output_path, 'wb') as f:
        writer.write(f)

    return send_file(output_path, as_attachment=True)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(debug=False, host='0.0.0.0', port=port)
