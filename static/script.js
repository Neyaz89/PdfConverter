document.addEventListener("DOMContentLoaded", function () {
  const dropArea = document.getElementById("drop-area");
  const fileInput = document.getElementById("fileElem");
  const convertButton = document.getElementById("convert-button");
  const loading = document.getElementById("loading-animation");

  let files = [];

  ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  dropArea.addEventListener("dragover", () => dropArea.classList.add("hover"));
  dropArea.addEventListener("dragleave", () => dropArea.classList.remove("hover"));
  dropArea.addEventListener("drop", handleDrop);
  fileInput.addEventListener("change", handleFiles);

  function handleDrop(e) {
    let dt = e.dataTransfer;
    let droppedFiles = dt.files;
    handleFiles({ target: { files: droppedFiles } });
  }

  function handleFiles(e) {
    files = [...e.target.files];
    const dropText = dropArea.querySelector("p");
    dropText.innerText = files.length + " file(s) selected";
  }

  convertButton.addEventListener("click", () => {
    if (!files.length) {
      alert("Please upload some image files first.");
      return;
    }

    const formData = new FormData();
    files.forEach(file => formData.append("files", file));
    formData.append("orientation", document.getElementById("orientation").value);
    formData.append("page_size", document.getElementById("page-size").value);
    formData.append("margin", document.getElementById("margin").value);
    formData.append("merge", document.getElementById("merge").checked);

    convertButton.disabled = true;
    loading.classList.remove("hidden");

    fetch("/upload", {
      method: "POST",
      body: formData
    })
      .then(response => {
        if (!response.ok) throw new Error("Conversion failed");
        return response.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "converted.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(err => alert(err.message))
      .finally(() => {
        convertButton.disabled = false;
        loading.classList.add("hidden");
      });
  });
});
