const uploadBox = document.getElementById("upload-area");
const fileInput = document.getElementById("file-input");
const browseBtn = document.getElementById("browse-btn");
const fileList = document.getElementById("file-list");
const convertBtn = document.getElementById("convert-btn");
const mergeBtn = document.getElementById("merge-btn");
const loading = document.getElementById("loading");
const resultDiv = document.getElementById("result");

let selectedFiles = [];

// Click handlers
uploadBox.addEventListener("click", () => fileInput.click());
browseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  selectedFiles = Array.from(fileInput.files);
  updateFileList();
});

uploadBox.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadBox.style.background = "#f0f0f0";
});

uploadBox.addEventListener("dragleave", () => {
  uploadBox.style.background = "white";
});

uploadBox.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadBox.style.background = "white";
  selectedFiles = Array.from(e.dataTransfer.files);
  updateFileList();
});

function updateFileList() {
  fileList.innerHTML = "";
  selectedFiles.forEach(file => {
    const li = document.createElement("li");
    li.textContent = file.name;
    fileList.appendChild(li);
  });
}

// Convert individually
convertBtn.addEventListener("click", async () => {
  if (selectedFiles.length === 0) {
    alert("Please select at least one file.");
    return;
  }

  loading.style.display = "block";
  resultDiv.innerHTML = "";

  for (const file of selectedFiles) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/convert", {
      method: "POST",
      body: formData,
    });

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name.replace(/\.[^/.]+$/, "") + ".pdf";
    link.textContent = `Download ${link.download}`;
    resultDiv.appendChild(link);
    resultDiv.appendChild(document.createElement("br"));
  }

  loading.style.display = "none";
});

// Merge into one
mergeBtn.addEventListener("click", async () => {
  if (selectedFiles.length === 0) {
    alert("Please select files to merge.");
    return;
  }

  loading.style.display = "block";
  resultDiv.innerHTML = "";

  const formData = new FormData();
  selectedFiles.forEach(f => formData.append("files", f));

  const response = await fetch("/merge", {
    method: "POST",
    body: formData,
  });

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "merged.pdf";
  link.textContent = "Download Merged PDF";
  resultDiv.appendChild(link);

  loading.style.display = "none";
});
