let selectedFile = null;
let currentConversion = 'convert';

function setConversionType(type) {
  currentConversion = type;
}

const dropArea = document.getElementById('drop-area');

['dragenter', 'dragover'].forEach(eventName => {
  dropArea.addEventListener(eventName, e => {
    e.preventDefault();
    dropArea.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, e => {
    e.preventDefault();
    dropArea.classList.remove('dragover');
  });
});

dropArea.addEventListener('drop', e => {
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles(files);
});

function handleFiles(files) {
  selectedFile = files[0];
  const preview = document.getElementById('preview');
  preview.innerHTML = `<p>Selected: ${selectedFile.name}</p>`;
}

function uploadFile() {
  if (!selectedFile) {
    alert('Please select a file to convert.');
    return;
  }

  const formData = new FormData();
  formData.append('file', selectedFile);

  const progressBar = document.getElementById('progressBar');
  document.querySelector('.progress-container').style.display = 'block';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `/${currentConversion}`, true);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percent = (e.loaded / e.total) * 100;
      progressBar.style.width = percent + '%';
    }
  };

  xhr.onload = () => {
    if (xhr.status === 200) {
      const blob = new Blob([xhr.response], { type: xhr.getResponseHeader('Content-Type') });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'converted_file';
      link.click();
    } else {
      alert('Conversion failed. Please try again.');
    }
    progressBar.style.width = '0%';
    document.querySelector('.progress-container').style.display = 'none';
  };

  xhr.onerror = () => {
    alert('Upload error. Please try again.');
    progressBar.style.width = '0%';
    document.querySelector('.progress-container').style.display = 'none';
  };

  xhr.responseType = 'blob';
  xhr.send(formData);
}
