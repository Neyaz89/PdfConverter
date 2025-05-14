const uploadArea = document.getElementById("upload-area");
const fileInput = document.getElementById("file-input");
const uploadBtn = document.getElementById("upload-btn");
const resultDiv = document.getElementById("result");
let selectedFile = null;

// Handle drag & drop
uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("dragover");
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("dragover");
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  fileInput.files = e.dataTransfer.files;
  selectedFile = fileInput.files[0];
});

// Click to open file input
uploadArea.addEventListener("click", () => {
  fileInput.click();
});

// File selected via input
fileInput.addEventListener("change", () => {
  selectedFile = fileInput.files[0];
});

// Handle upload
uploadBtn.addEventListener("click", async () => {
  if (!selectedFile) {
    alert("Please select a file first!");
    return;
  }

  const formData = new FormData();
  formData.append("file", selectedFile);

  try {
    const response = await fetch("/convert", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error("Conversion failed");

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    resultDiv.innerHTML = `<a href="${downloadUrl}" download="converted.pdf">Download Converted PDF</a>`;
  } catch (error) {
    resultDiv.textContent = "Error converting file.";
    console.error(error);
  }
});
