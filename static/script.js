document.addEventListener("DOMContentLoaded", function () {
  const fileInput = document.getElementById("fileInput");
  if (fileInput) {
    fileInput.addEventListener("change", function () {
      const label = document.querySelector(".file-label");
      if (label && fileInput.files.length > 0) {
        label.textContent = `${fileInput.files.length} file(s) selected`;
      }
    });
  }
});
