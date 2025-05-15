import os
import tempfile
from flask import Flask, request, send_file, jsonify, render_template
from werkzeug.utils import secure_filename
from PIL import Image

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = tempfile.mkdtemp()

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload():
    if 'files' not in request.files:
        return jsonify({'error': 'No files part in request'}), 400

    files = request.files.getlist('files')
    orientation = request.form.get('orientation', 'portrait')
    page_size = request.form.get('page_size', 'fit')
    margin = request.form.get('margin', 'none')
    merge = request.form.get('merge', 'true').lower() == 'true'

    images = []

    for file in files:
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            img = Image.open(filepath).convert('RGB')
            images.append(img)
        else:
            return jsonify({'error': 'Invalid file type'}), 400

    if not images:
        return jsonify({'error': 'No valid images found'}), 400

    # Define size and margin
    page_dims = {
        'A4': (595, 842),         # A4 size in points
        'letter': (612, 792),     # Letter size
    }

    def add_margin(img, margin_type):
        if margin_type == 'none':
            return img
        elif margin_type == 'small':
            border = 20
        elif margin_type == 'big':
            border = 60
        else:
            border = 0
        new_img = Image.new("RGB", (img.width + 2 * border, img.height + 2 * border), "white")
        new_img.paste(img, (border, border))
        return new_img

    processed_images = []
    for img in images:
        img = add_margin(img, margin)

        # Resize to fit page if needed
        if page_size in page_dims:
            width, height = page_dims[page_size]
            if orientation == 'landscape':
                width, height = height, width
            img.thumbnail((width, height))

            # Create white background page and center image
            page = Image.new("RGB", (width, height), "white")
            x = (width - img.width) // 2
            y = (height - img.height) // 2
            page.paste(img, (x, y))
            processed_images.append(page)
        else:
            # Use "fit" option: just add margin and use original image
            processed_images.append(img)

    output_pdf = os.path.join(app.config['UPLOAD_FOLDER'], 'output.pdf')

    if merge:
        processed_images[0].save(output_pdf, save_all=True, append_images=processed_images[1:])
    else:
        # For now, even without merge we return one file
        processed_images[0].save(output_pdf, save_all=True, append_images=processed_images[1:])

    return send_file(output_pdf, as_attachment=True, download_name="converted.pdf")

if __name__ == '__main__':
    app.run(debug=True)
