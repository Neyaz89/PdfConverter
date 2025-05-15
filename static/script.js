// Initialize Lottie animations
const uploadAnimation = lottie.loadAnimation({
  container: document.getElementById('upload-animation'),
  renderer: 'svg',
  loop: true,
  autoplay: true,
  path: 'https://assets10.lottiefiles.com/packages/lf20_j1adxtyb.json' // Replace with your desired animation
});

const loadingAnimation = lottie.loadAnimation({
  container: document.getElementById('loading-animation'),
  renderer: 'svg',
  loop: true,
  autoplay: false,
  path: 'https://assets10.lottiefiles.com/packages/lf20_j1adxtyb.json' // Replace with your desired animation
});

const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('fileElem');
let files = [];

// Prevent default behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Highlight drop area when item is dragged over it
['dragenter', 'dragover'].forEach(eventName => {
  dropArea.addEventListener(eventName, () => dropArea.classList.add('hover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, () => dropArea.classList.remove('hover'), false);
});

// Handle dropped files
dropArea.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
  const dt = e.dataTransfer;
  const droppedFiles = dt.files;
  handleFiles(droppedFiles);
}

fileInput.addEventListener('change', () => {
  handleFiles(fileInput.files);
});

function handleFiles(selectedFiles) {
  for (let i = 0; i < selectedFiles.length; i++) {
    if (selectedFiles[i].type.startsWith('image/')) {
      files.push(selectedFiles[i]);
    }
  }
  alert(`${files.length} image(s) selected.`);
}

// Handle form submission
document.getElementById('convert-button').addEventListener('click', () => {
  if (files.length === 0) {
    alert('Please select at least one image file.');
    return;
  }

  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  const orientation = document.getElementById('orientation').value;
  const pageSize = document.getElementById('page-size').value;
  const margin = document.getElementById('margin').value;
  const merge = document.getElementById('merge').checked;

  formData.append('orientation', orientation);
  formData.append('page_size', pageSize);
  formData.append('margin', margin);
  formData.append('merge', merge);

  // Show loading animation
  document.getElementById('loading-animation').classList.remove('hidden');
  loadingAnimation.play();

  fetch('/upload', {
    method: 'POST',
    body: formData
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Conversion failed.');
      }
      return response.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'converted.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch(error => {
      alert(error.message);
    })
    .finally(() => {
      // Hide loading animation
      loadingAnimation.stop();
      document.getElementById('loading-animation').classList.add('hidden');
    });
});
