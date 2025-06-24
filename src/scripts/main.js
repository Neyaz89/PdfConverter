class PDFConverter {
    constructor() {
        this.init();
        this.setupEventListeners();
        this.setupAnimations();
        this.setupCounters();
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

        // CTA buttons
        document.querySelector('.primary-cta')?.addEventListener('click', () => {
            this.scrollToConverter();
        });

        document.querySelector('.secondary-cta')?.addEventListener('click', () => {
            this.showDemo();
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

        // Enhanced navbar scroll effect
        window.addEventListener('scroll', () => {
            const navbar = document.querySelector('.navbar');
            const scrolled = window.scrollY;
            
            if (scrolled > 100) {
                navbar.style.background = 'rgba(255, 255, 255, 0.2)';
                navbar.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
            } else {
                navbar.style.background = 'rgba(255, 255, 255, 0.1)';
                navbar.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
            }
        });

        // Mobile menu toggle
        const mobileToggle = document.querySelector('.mobile-menu-toggle');
        const navLinks = document.querySelector('.nav-links');
        
        mobileToggle?.addEventListener('click', () => {
            navLinks.classList.toggle('mobile-open');
            mobileToggle.classList.toggle('active');
        });
    }

    setupAnimations() {
        // Enhanced Intersection Observer for scroll animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    
                    // Add staggered animation for grid items
                    if (entry.target.classList.contains('feature-card') || 
                        entry.target.classList.contains('tool-card') ||
                        entry.target.classList.contains('testimonial-card')) {
                        const siblings = Array.from(entry.target.parentElement.children);
                        const index = siblings.indexOf(entry.target);
                        entry.target.style.animationDelay = `${index * 0.1}s`;
                        entry.target.classList.add('animate-in');
                    }
                }
            });
        }, observerOptions);

        // Observe elements for animation
        document.querySelectorAll('.feature-card, .tool-card, .testimonial-card, .section-header').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(50px)';
            el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
            observer.observe(el);
        });

        // Enhanced parallax effect
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const parallaxElements = document.querySelectorAll('.gradient-orb');
            
            parallaxElements.forEach((el, index) => {
                const speed = 0.3 + (index * 0.1);
                const yPos = -(scrolled * speed);
                el.style.transform = `translateY(${yPos}px)`;
            });

            // Parallax for geometric shapes
            document.querySelectorAll('.shape').forEach((shape, index) => {
                const speed = 0.2 + (index * 0.05);
                const yPos = -(scrolled * speed);
                shape.style.transform = `translateY(${yPos}px) rotate(${scrolled * 0.1}deg)`;
            });
        });

        // Enhanced typing effect for hero title
        this.typeWriter();
        
        // Add floating animation to cards
        this.setupFloatingCards();
    }

    setupCounters() {
        // Animated counters for statistics
        const counters = document.querySelectorAll('[data-count]');
        
        const animateCounter = (counter) => {
            const target = parseInt(counter.dataset.count);
            const duration = 2000;
            const step = target / (duration / 16);
            let current = 0;
            
            const timer = setInterval(() => {
                current += step;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                
                if (target > 1000000) {
                    counter.textContent = (current / 1000000).toFixed(1) + 'M+';
                } else if (target > 1000) {
                    counter.textContent = (current / 1000).toFixed(0) + 'K+';
                } else if (target < 10) {
                    counter.textContent = current.toFixed(1) + (target === 99.9 ? '%' : 's');
                } else {
                    counter.textContent = Math.floor(current);
                }
            }, 16);
        };

        // Trigger counters when they come into view
        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    counterObserver.unobserve(entry.target);
                }
            });
        });

        counters.forEach(counter => {
            counterObserver.observe(counter);
        });
    }

    typeWriter() {
        const titleElement = document.querySelector('.hero-title');
        if (!titleElement) return;

        const lines = titleElement.querySelectorAll('.title-line');
        if (lines.length === 0) return;

        lines.forEach((line, index) => {
            const originalText = line.textContent;
            line.textContent = '';
            
            setTimeout(() => {
                let i = 0;
                const timer = setInterval(() => {
                    if (i < originalText.length) {
                        line.textContent += originalText.charAt(i);
                        i++;
                    } else {
                        clearInterval(timer);
                    }
                }, 50);
            }, index * 1000);
        });
    }

    setupFloatingCards() {
        const floatingCards = document.querySelectorAll('.floating-card');
        
        floatingCards.forEach((card, index) => {
            // Add random floating animation
            const randomDelay = Math.random() * 2;
            const randomDuration = 4 + Math.random() * 2;
            
            card.style.animationDelay = `${randomDelay}s`;
            card.style.animationDuration = `${randomDuration}s`;
        });
    }

    scrollToConverter() {
        document.querySelector('.quick-convert').scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
        
        // Add attention-grabbing animation
        setTimeout(() => {
            const uploadZone = this.uploadZone;
            uploadZone.style.transform = 'scale(1.05)';
            uploadZone.style.boxShadow = '0 25px 50px rgba(59, 130, 246, 0.3)';
            
            setTimeout(() => {
                uploadZone.style.transform = 'scale(1)';
                uploadZone.style.boxShadow = 'none';
            }, 1000);
        }, 500);
    }

    showDemo() {
        // Create and show demo modal
        const modal = document.createElement('div');
        modal.className = 'demo-modal';
        modal.innerHTML = `
            <div class="demo-modal-content">
                <div class="demo-header">
                    <h3>🎬 Watch Our Demo</h3>
                    <button class="demo-close">&times;</button>
                </div>
                <div class="demo-body">
                    <div class="demo-placeholder">
                        <div class="demo-play-button">▶</div>
                        <p>Demo video would play here</p>
                        <p class="demo-description">See how easy it is to convert your documents with our advanced AI-powered tools.</p>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal styles
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        `;
        
        document.body.appendChild(modal);
        
        // Close modal functionality
        const closeModal = () => {
            modal.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 300);
        };
        
        modal.querySelector('.demo-close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
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
        const progressPercentage = document.querySelector('.progress-percentage');
        
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 12;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                this.showConversionOptions();
            }
            
            progressFill.style.width = `${progress}%`;
            progressPercentage.textContent = `${Math.round(progress)}%`;
            
            // Update progress text based on progress
            if (progress < 30) {
                progressText.textContent = 'Analyzing your files with AI...';
            } else if (progress < 60) {
                progressText.textContent = 'Optimizing for best quality...';
            } else if (progress < 90) {
                progressText.textContent = 'Preparing conversion options...';
            } else {
                progressText.textContent = 'Almost ready!';
            }
        }, 150);
    }

    showConversionOptions() {
        setTimeout(() => {
            this.uploadProgress.style.display = 'none';
            this.conversionOptions.style.display = 'block';
            
            // Animate options in with stagger
            const options = document.querySelectorAll('.option-btn');
            options.forEach((option, index) => {
                option.style.opacity = '0';
                option.style.transform = 'translateY(30px) scale(0.9)';
                option.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                
                setTimeout(() => {
                    option.style.opacity = '1';
                    option.style.transform = 'translateY(0) scale(1)';
                }, index * 150);
            });
        }, 800);
    }

    selectConversionType(type) {
        this.selectedConversionType = type;
        
        // Update UI with enhanced selection feedback
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.style.transform = 'translateY(0) scale(1)';
        });
        
        const selectedBtn = document.querySelector(`[data-type="${type}"]`);
        selectedBtn.classList.add('selected');
        selectedBtn.style.transform = 'translateY(-5px) scale(1.02)';
        
        // Add selection confirmation animation
        this.showSelectionConfirmation(selectedBtn);
        
        // Auto-start conversion after selection
        setTimeout(() => {
            this.startConversion();
        }, 1000);
    }

    showSelectionConfirmation(button) {
        // Create confirmation checkmark
        const checkmark = document.createElement('div');
        checkmark.innerHTML = '✓';
        checkmark.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: var(--success-500);
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 16px;
            animation: checkmarkPop 0.5s ease;
            z-index: 10;
        `;
        
        button.style.position = 'relative';
        button.appendChild(checkmark);
        
        // Remove checkmark after animation
        setTimeout(() => {
            if (checkmark.parentNode) {
                checkmark.parentNode.removeChild(checkmark);
            }
        }, 2000);
    }

    selectTool(tool) {
        // Enhanced tool selection with smooth scroll and highlight
        this.scrollToConverter();
        
        // Show tool-specific message
        setTimeout(() => {
            this.showNotification(`${this.getToolName(tool)} selected! Upload your files to get started.`, 'info');
        }, 1000);
    }

    getToolName(tool) {
        const toolNames = {
            'pdf-to-jpg': 'PDF to JPG Converter',
            'jpg-to-pdf': 'JPG to PDF Merger',
            'pdf-to-docx': 'PDF to DOCX Editor',
            'compress-pdf': 'PDF Compressor Pro'
        };
        return toolNames[tool] || 'Tool';
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

        // Show enhanced processing state
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
            'pdf-to-jpg': 'converted-images.zip',
            'jpg-to-pdf': 'merged-document.pdf',
            'pdf-to-docx': 'editable-document.docx',
            'docx-to-pdf': 'converted-document.pdf',
            'compress-pdf': 'compressed-document.pdf'
        };
        return fileNames[type];
    }

    showProcessingState() {
        const progressText = document.querySelector('.progress-text');
        const progressPercentage = document.querySelector('.progress-percentage');
        
        progressText.textContent = 'Converting with AI precision...';
        progressPercentage.textContent = '0%';
        
        this.conversionOptions.style.display = 'none';
        this.uploadProgress.style.display = 'block';
        
        // Enhanced progress animation
        const progressFill = document.querySelector('.progress-fill');
        progressFill.style.width = '0%';
        
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 8;
            if (progress >= 95) {
                progress = 95;
                clearInterval(interval);
            }
            
            progressFill.style.width = `${progress}%`;
            progressPercentage.textContent = `${Math.round(progress)}%`;
            
            // Dynamic processing messages
            if (progress < 25) {
                progressText.textContent = 'Analyzing document structure...';
            } else if (progress < 50) {
                progressText.textContent = 'Applying AI optimization...';
            } else if (progress < 75) {
                progressText.textContent = 'Enhancing quality...';
            } else {
                progressText.textContent = 'Finalizing conversion...';
            }
        }, 200);
        
        // Store interval for cleanup
        this.processingInterval = interval;
    }

    showSuccessState() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
        }
        
        const progressText = document.querySelector('.progress-text');
        const progressFill = document.querySelector('.progress-fill');
        const progressPercentage = document.querySelector('.progress-percentage');
        
        progressFill.style.width = '100%';
        progressPercentage.textContent = '100%';
        progressText.textContent = '🎉 Conversion completed! Download started automatically.';
        progressText.style.color = 'var(--success-500)';
        
        // Add success animation
        const processingDots = document.querySelector('.processing-animation');
        if (processingDots) {
            processingDots.innerHTML = '<div style="font-size: 2rem;">✅</div>';
        }
        
        // Show success notification
        this.showNotification('Conversion completed successfully! Your file is ready.', 'success');
        
        // Reset after delay
        setTimeout(() => {
            this.resetUploadState();
        }, 4000);
    }

    showErrorState() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
        }
        
        const progressText = document.querySelector('.progress-text');
        progressText.textContent = '❌ Conversion failed. Please try again or contact support.';
        progressText.style.color = 'var(--error-500)';
        
        // Add error animation
        const processingDots = document.querySelector('.processing-animation');
        if (processingDots) {
            processingDots.innerHTML = '<div style="font-size: 2rem;">❌</div>';
        }
        
        // Show error notification
        this.showNotification('Conversion failed. Please try again or contact our support team.', 'error');
        
        setTimeout(() => {
            this.resetUploadState();
        }, 4000);
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
        
        // Reset processing animation
        const processingDots = document.querySelector('.processing-animation');
        if (processingDots) {
            processingDots.innerHTML = `
                <div class="processing-dot"></div>
                <div class="processing-dot"></div>
                <div class="processing-dot"></div>
            `;
        }
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

    // Enhanced notification system
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        notification.innerHTML = `
            <div class="notification-icon">${icons[type]}</div>
            <div class="notification-content">
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">&times;</button>
        `;
        
        const colors = {
            success: 'var(--success-500)',
            error: 'var(--error-500)',
            warning: 'var(--warning-500)',
            info: 'var(--primary-500)'
        };
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            min-width: 300px;
            max-width: 400px;
            padding: 16px;
            background: white;
            color: var(--neutral-800);
            border-left: 4px solid ${colors[type]};
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-xl);
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            display: flex;
            align-items: center;
            gap: 12px;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Close functionality
        const closeNotification = () => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        };
        
        notification.querySelector('.notification-close').addEventListener('click', closeNotification);
        
        // Auto close after 5 seconds
        setTimeout(closeNotification, 5000);
    }

    // Performance monitoring
    trackConversion(type, fileSize, duration) {
        // Analytics tracking would go here
        console.log(`Conversion Analytics: ${type}, Size: ${fileSize}MB, Duration: ${duration}ms`);
        
        // Could integrate with analytics services like Google Analytics, Mixpanel, etc.
        if (typeof gtag !== 'undefined') {
            gtag('event', 'conversion_completed', {
                'conversion_type': type,
                'file_size': fileSize,
                'duration': duration
            });
        }
    }
}

// Initialize the application with enhanced features
document.addEventListener('DOMContentLoaded', () => {
    const converter = new PDFConverter();
    window.pdfConverter = converter; // Make globally accessible
    
    // Add loading animation
    addLoadingAnimation();
    
    // Setup keyboard navigation
    setupKeyboardNavigation();
    
    // Setup accessibility features
    setupAccessibility();
    
    // Add performance monitoring
    setupPerformanceMonitoring();
    
    // Add CSS animations for notifications
    addNotificationStyles();
});

function addLoadingAnimation() {
    // Enhanced loading animation
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="loading-content">
            <div class="loading-logo">
                <div class="nm-logo-large">NM</div>
                <div class="loading-text">Neyaz's World</div>
            </div>
            <div class="loading-spinner">
                <div class="spinner-ring"></div>
                <div class="spinner-ring"></div>
                <div class="spinner-ring"></div>
            </div>
            <div class="loading-message">Loading premium experience...</div>
        </div>
    `;
    
    loadingOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.5s ease;
    `;
    
    document.body.appendChild(loadingOverlay);
    
    // Remove loading overlay after page loads
    window.addEventListener('load', () => {
        setTimeout(() => {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(loadingOverlay)) {
                    document.body.removeChild(loadingOverlay);
                }
                document.body.classList.add('loaded');
            }, 500);
        }, 1000);
    });
}

function setupKeyboardNavigation() {
    // Enhanced keyboard navigation
    document.addEventListener('keydown', (e) => {
        const converter = window.pdfConverter;
        
        switch(e.key) {
            case 'Escape':
                // Close any open modals or reset states
                if (converter) {
                    converter.resetUploadState();
                }
                // Close notifications
                document.querySelectorAll('.notification').forEach(notification => {
                    notification.querySelector('.notification-close').click();
                });
                break;
                
            case 'Enter':
                // Quick convert shortcut
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    converter?.scrollToConverter();
                }
                break;
                
            case 'h':
                // Help shortcut
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    converter?.showDemo();
                }
                break;
        }
    });
    
    // Add keyboard focus indicators
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            document.body.classList.add('keyboard-navigation');
        }
    });
    
    document.addEventListener('mousedown', () => {
        document.body.classList.remove('keyboard-navigation');
    });
}

function setupAccessibility() {
    // Enhanced accessibility features
    const uploadZone = document.getElementById('uploadZone');
    if (uploadZone) {
        uploadZone.setAttribute('role', 'button');
        uploadZone.setAttribute('aria-label', 'Click to upload files or drag and drop files here');
        uploadZone.setAttribute('tabindex', '0');
        
        uploadZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.getElementById('fileInput').click();
            }
        });
    }
    
    // Add ARIA labels to interactive elements
    document.querySelectorAll('.option-btn').forEach((btn, index) => {
        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '0');
        btn.setAttribute('aria-label', `Select ${btn.querySelector('.option-title').textContent} conversion option`);
    });
    
    // Add skip link for screen readers
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.textContent = 'Skip to main content';
    skipLink.className = 'skip-link';
    skipLink.style.cssText = `
        position: absolute;
        top: -40px;
        left: 6px;
        background: var(--primary-600);
        color: white;
        padding: 8px;
        text-decoration: none;
        border-radius: 4px;
        z-index: 10000;
        transition: top 0.3s;
    `;
    
    skipLink.addEventListener('focus', () => {
        skipLink.style.top = '6px';
    });
    
    skipLink.addEventListener('blur', () => {
        skipLink.style.top = '-40px';
    });
    
    document.body.insertBefore(skipLink, document.body.firstChild);
    
    // Add main content landmark
    const mainContent = document.querySelector('.quick-convert');
    if (mainContent) {
        mainContent.id = 'main-content';
        mainContent.setAttribute('role', 'main');
    }
}

function setupPerformanceMonitoring() {
    // Performance monitoring and optimization
    if ('performance' in window) {
        window.addEventListener('load', () => {
            const perfData = performance.getEntriesByType('navigation')[0];
            console.log('Page Load Performance:', {
                loadTime: perfData.loadEventEnd - perfData.loadEventStart,
                domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
                totalTime: perfData.loadEventEnd - perfData.fetchStart
            });
        });
    }
    
    // Monitor conversion performance
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const startTime = performance.now();
        return originalFetch.apply(this, args).then(response => {
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            if (args[0].includes('/convert/')) {
                console.log(`Conversion API Performance: ${duration.toFixed(2)}ms`);
                window.pdfConverter?.trackConversion(
                    args[0].split('/').pop(),
                    0, // File size would be calculated from FormData
                    duration
                );
            }
            
            return response;
        });
    };
}

function addNotificationStyles() {
    // Add CSS for notifications and other dynamic elements
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        
        @keyframes checkmarkPop {
            0% { transform: scale(0); opacity: 0; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
        }
        
        .demo-modal-content {
            background: white;
            border-radius: var(--radius-2xl);
            padding: var(--space-8);
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .demo-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--space-6);
            padding-bottom: var(--space-4);
            border-bottom: 1px solid var(--neutral-200);
        }
        
        .demo-close {
            background: none;
            border: none;
            
            font-size: var(--font-size-2xl);
            cursor: pointer;
            color: var(--neutral-500);
            transition: var(--transition-fast);
        }
        
        .demo-close:hover {
            color: var(--neutral-800);
        }
        
        .demo-placeholder {
            text-align: center;
            padding: var(--space-16);
            background: var(--neutral-100);
            border-radius: var(--radius-xl);
            position: relative;
        }
        
        .demo-play-button {
            width: 80px;
            height: 80px;
            background: var(--primary-500);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: var(--font-size-2xl);
            margin: 0 auto var(--space-4);
            cursor: pointer;
            transition: var(--transition-normal);
        }
        
        .demo-play-button:hover {
            background: var(--primary-600);
            transform: scale(1.1);
        }
        
        .loading-content {
            text-align: center;
            color: white;
        }
        
        .nm-logo-large {
            font-size: 4rem;
            font-weight: 900;
            font-family: var(--font-family-primary);
            margin-bottom: var(--space-4);
            background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.6));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .loading-text {
            font-size: var(--font-size-2xl);
            font-weight: 600;
            margin-bottom: var(--space-8);
        }
        
        .loading-spinner {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-bottom: var(--space-6);
        }
        
        .spinner-ring {
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,0.3);
            border-top: 3px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        .spinner-ring:nth-child(2) {
            animation-delay: 0.1s;
        }
        
        .spinner-ring:nth-child(3) {
            animation-delay: 0.2s;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .loading-message {
            font-size: var(--font-size-base);
            opacity: 0.8;
        }
        
        .notification-icon {
            font-size: var(--font-size-xl);
            flex-shrink: 0;
        }
        
        .notification-content {
            flex: 1;
        }
        
        .notification-message {
            font-weight: 500;
            line-height: 1.4;
        }
        
        .notification-close {
            background: none;
            border: none;
            font-size: var(--font-size-xl);
            cursor: pointer;
            color: var(--neutral-400);
            transition: var(--transition-fast);
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .notification-close:hover {
            color: var(--neutral-600);
        }
        
        .skip-link:focus {
            outline: 2px solid var(--primary-400);
            outline-offset: 2px;
        }
        
        .keyboard-navigation *:focus {
            outline: 2px solid var(--primary-400);
            outline-offset: 2px;
        }
        
        .animate-in {
            animation: slideInUp 0.6s ease forwards;
        }
        
        /* Mobile menu styles */
        @media (max-width: 768px) {
            .nav-links {
                position: fixed;
                top: 100%;
                left: 0;
                right: 0;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(20px);
                flex-direction: column;
                padding: var(--space-6);
                gap: var(--space-4);
                transition: var(--transition-normal);
                border-top: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .nav-links.mobile-open {
                top: 100%;
                display: flex;
            }
            
            .mobile-menu-toggle.active span:nth-child(1) {
                transform: rotate(45deg) translate(5px, 5px);
            }
            
            .mobile-menu-toggle.active span:nth-child(2) {
                opacity: 0;
            }
            
            .mobile-menu-toggle.active span:nth-child(3) {
                transform: rotate(-45deg) translate(7px, -6px);
            }
        }
    `;
    
    document.head.appendChild(style);
}

// Export for global access if needed
window.PDFConverter = PDFConverter;