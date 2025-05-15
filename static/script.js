document.addEventListener("DOMContentLoaded", () => {
  const uploadForm = document.getElementById("uploadForm");

  if (uploadForm) {
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const formData = new FormData(uploadForm);
      const action = uploadForm.getAttribute("action");

      try {
        const response = await fetch(action, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "converted_file." + getFileExtension(action);
          link.click();
        } else {
          alert("Conversion failed.");
        }
      } catch (err) {
        alert("An error occurred. Please try again.");
        console.error(err);
      }
    });
  }
});

function getFileExtension(actionUrl) {
  if (actionUrl.includes("jpg-to-pdf") || actionUrl.includes("docx-to-pdf")) return "pdf";
  if (actionUrl.includes("pdf-to-jpg")) return "zip";
  if (actionUrl.includes("pdf-to-docx")) return "docx";
  if (actionUrl.includes("compress-pdf")) return "pdf";
  return "file";
}
