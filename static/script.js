document.addEventListener("DOMContentLoaded", () => {
  const dropArea = document.getElementById("drop-area");
  const fileElem = document.getElementById("fileElem");

  dropArea.addEventListener("click", () => fileElem.click());

  dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropArea.classList.add("highlight");
  });

  dropArea.addEventListener("dragleave", () => {
    dropArea.classList.remove("highlight");
  });

  dropArea.addEventListener("drop", (e) => {
    e.preventDefault();
    fileElem.files = e.dataTransfer.files;
    dropArea.classList.remove("highlight");
  });
});