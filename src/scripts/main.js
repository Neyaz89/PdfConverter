class PDFConverter {
    constructor() {
        this.init();
        this.setupEventListeners();
        this.setupAnimations();
    }

    init() {
        this.uploadZone = document.getElementById('uploadZone');
        this.fileInput = document.getElementById('fileInput');
        this.uploadProgress = document.getElementById('uploadProgress');
        this.conversionOptions = document.getElementById('conversionOptions');
        this.selectedFiles = [];
        this.selectedConversionType = null;
    }

    setupEventListeners() {
        // Upload zone interactions
        this.uploadZone.addEventListener('click', () => {
            this.fileInput.click();
        });

        this.uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadZone.classList.add('dragover');
        });

        this.uploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.uploadZone.classList.remove('dragover');
        });

        this.uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        this.fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Conversion option buttons
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectConversionType(btn.dataset.type);
            });
        });

        // Tool cards
        document.querySelectorAll('.tool-card').forEach(card => {
            card.addEventListener('click', () => {
                this.selectTool(card.dataset.tool);
            });
        });

        // Smooth scrolling for navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });

        // Navbar scroll effect
        window.addEventListener('scroll', () => {
            const navbar = document.querySelector('.navbar');
            if (window.scrollY > 100) {
                navbar.style.background = 'rgba(255, 255, 255, 0.15)';
            } else {
                navbar.style.background = 'rgba(255, 255, 255, 0.1)';
            }
        });
    }

    setupAnimations() {
        // Intersection Observer for scroll animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        // Observe elements for animation
        document.querySelectorAll('.feature-card, .tool-card').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        });

        // Parallax effect for background orbs
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const parallaxElements = document.querySelectorAll('.gradient-orb');
            
            parallaxElements.forEach((el, index) => {
                const speed = 0.5 + (index * 0.1);
                el.style.transform = `translateY(${scrolled * speed}px)`;
            });
        });

        // Typing effect for hero title
        this.typeWriter();
    }

    typeWriter() {
        const titleElement = document.querySelector('.hero-title');
        if (!titleElement) return;

        const originalText = titleElement.innerHTML;
        titleElement.innerHTML = '';
        
        let i = 0;
        const timer = setInterval(() => {
            if (i < originalText.length) {
                titleElement.innerHTML += originalText.charAt(i);
                i++;
            } else {
                clearInterval(timer);
            }
        }, 50);
    }

    handleFiles(files) {
        this.selectedFiles = Array.from(files);
        
        if (this.selectedFiles.length > 0) {
            this.showUploadProgress();
            this.simulateUpload();
        }
    }

    showUploadProgress() {
        const uploadContent = document.querySelector('.upload-content');
        uploadContent.style.display = 'none';
        this.uploadProgress.style.display = 'block';
    }

    simulateUpload() {
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                this.showConversionOptions();
            }
            
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `Processing... ${Math.round(progress)}%`;
        }, 200);
    }

    showConversionOptions() {
        setTimeout(() => {
            this.uploadProgress.style.display = 'none';
            this.conversionOptions.style.display = 'block';
            
            // Animate options in
            const options = document.querySelectorAll('.option-btn');
            options.forEach((option, index) => {
                setTimeout(() => {
                    option.style.opacity = '0';
                    option.style.transform = 'translateY(20px)';
                    option.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    
                    setTimeout(() => {
                        option.style.opacity = '1';
                        option.style.transform = 'translateY(0)';
                    }, 50);
                }, index * 100);
            });
        }, 500);
    }

    selectConversionType(type) {
        this.selectedConversionType = type;
        
        // Update UI
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        document.querySelector(`[data-type="${type}"]`).classList.add('selected');
        
        // Show convert button or start conversion
        this.startConversion();
    }

    selectTool(tool) {
        // Scroll to quick convert section
        document.querySelector('.quick-convert').scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
        
        // Highlight the upload zone
        setTimeout(() => {
            this.uploadZone.style.transform = 'scale(1.02)';
            this.uploadZone.style.boxShadow = '0 20px 40px rgba(0,0,0,0.2)';
            
            setTimeout(() => {
                this.uploadZone.style.transform = 'scale(1)';
                this.uploadZone.style.boxShadow = 'none';
            }, 1000);
        }, 500);
    }

    startConversion() {
        if (!this.selectedConversionType || this.selectedFiles.length === 0) {
            return;
        }

        // Create form data
        const formData = new FormData();
        
        if (this.selectedConversionType === 'jpg-to-pdf') {
            this.selectedFiles.forEach(file => {
                formData.append('files', file);
            });
        } else {
            formData.append('file', this.selectedFiles[0]);
        }

        // Show processing state
        this.showProcessingState();

        // Make API call
        const endpoint = this.getEndpoint(this.selectedConversionType);
        
        fetch(endpoint, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Conversion failed');
            }
            return response.blob();
        })
        .then(blob => {
            this.downloadFile(blob, this.getFileName(this.selectedConversionType));
            this.showSuccessState();
        })
        .catch(error => {
            console.error('Conversion error:', error);
            this.showErrorState();
        });
    }

    getEndpoint(type) {
        const endpoints = {
            'pdf-to-jpg': '/convert/pdf-to-jpg',
            'jpg-to-pdf': '/convert/jpg-to-pdf',
            'pdf-to-docx': '/convert/pdf-to-docx',
            'docx-to-pdf': '/convert/docx-to-pdf',
            'compress-pdf': '/convert/compress-pdf'
        };
        return endpoints[type];
    }

    getFileName(type) {
        const fileNames = {
            'pdf-to-jpg': 'images.zip',
            'jpg-to-pdf': 'output.pdf',
            'pdf-to-docx': 'output.docx',
            'docx-to-pdf': 'output.pdf',
            'compress-pdf': 'compressed.pdf'
        };
        return fileNames[type];
    }

    showProcessingState() {
        const progressText = document.querySelector('.progress-text');
        progressText.textContent = 'Converting your files...';
        
        this.conversionOptions.style.display = 'none';
        this.uploadProgress.style.display = 'block';
        
        // Animate progress bar
        const progressFill = document.querySelector('.progress-fill');
        progressFill.style.width = '0%';
        
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 10;
            if (progress >= 90) {
                progress = 90;
                clearInterval(interval);
            }
            progressFill.style.width = `${progress}%`;
        }, 300);
    }

    showSuccessState() {
        const progressText = document.querySelector('.progress-text');
        const progressFill = document.querySelector('.progress-fill');
        
        progressFill.style.width = '100%';
        progressText.textContent = 'Conversion completed! Download started.';
        progressText.style.color = 'var(--success-500)';
        
        // Reset after delay
        setTimeout(() => {
            this.resetUploadState();
        }, 3000);
    }

    showErrorState() {
        const progressText = document.querySelector('.progress-text');
        progressText.textContent = 'Conversion failed. Please try again.';
        progressText.style.color = 'var(--error-500)';
        
        setTimeout(() => {
            this.resetUploadState();
        }, 3000);
    }

    resetUploadState() {
        const uploadContent = document.querySelector('.upload-content');
        const progressText = document.querySelector('.progress-text');
        
        this.uploadProgress.style.display = 'none';
        this.conversionOptions.style.display = 'none';
        uploadContent.style.display = 'block';
        
        progressText.style.color = 'var(--primary-600)';
        this.selectedFiles = [];
        this.selectedConversionType = null;
        this.fileInput.value = '';
    }

    downloadFile(blob, filename) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    // Utility methods for enhanced UX
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'success' ? 'var(--success-500)' : 
                        type === 'error' ? 'var(--error-500)' : 'var(--primary-500)'};
            color: white;
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // Performance monitoring
    trackConversion(type, fileSize, duration) {
        // Analytics tracking would go here
        console.log(`Conversion: ${type}, Size: ${fileSize}MB, Duration: ${duration}ms`);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new PDFConverter();
    
    // Add some extra polish
    addLoadingAnimation();
    setupKeyboardNavigation();
    setupAccessibility();
});

function addLoadingAnimation() {
    // Remove loading class after page loads
    window.addEventListener('load', () => {
        document.body.classList.add('loaded');
    });
}

function setupKeyboardNavigation() {
    // Enhanced keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Close any open modals or reset states
            const converter = window.pdfConverter;
            if (converter) {
                converter.resetUploadState();
            }
        }
    });
}

function setupAccessibility() {
    // Add ARIA labels and improve accessibility
    const uploadZone = document.getElementById('uploadZone');
    if (uploadZone) {
        uploadZone.setAttribute('role', 'button');
        uploadZone.setAttribute('aria-label', 'Click to upload files or drag and drop');
        uploadZone.setAttribute('tabindex', '0');
        
        uploadZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.getElementById('fileInput').click();
            }
        });
    }
}

// Export for global access if needed
window.PDFConverter = PDFConverter;