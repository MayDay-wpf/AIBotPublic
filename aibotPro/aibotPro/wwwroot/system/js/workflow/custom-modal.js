class CustomModal {
    constructor(options) {
        this.options = options;
        this.overlay = null;
        this.modal = null;
        this.dragging = false;
        this.startX = 0;
        this.startY = 0;
        this.createModal();
    }

    createModal() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'custom-modal-overlay';

        this.modal = document.createElement('div');
        this.modal.className = 'custom-modal';

        const header = document.createElement('div');
        header.className = 'custom-modal-header';

        const title = document.createElement('h2');
        title.className = 'custom-modal-title';
        title.textContent = this.options.title || 'Modal';

        const closeButton = document.createElement('button');
        closeButton.className = 'custom-modal-close';
        closeButton.textContent = '×';
        closeButton.addEventListener('click', () => this.close());

        header.appendChild(title);
        header.appendChild(closeButton);

        // Event listeners for dragging the modal
        header.addEventListener('mousedown', this.startDrag.bind(this));
        document.addEventListener('mousemove', this.onDrag.bind(this));
        document.addEventListener('mouseup', this.stopDrag.bind(this));

        const content = document.createElement('div');
        content.className = 'custom-modal-content';

        const footer = document.createElement('div');
        footer.className = 'custom-modal-footer';

        this.modal.appendChild(header);
        this.modal.appendChild(content);
        this.modal.appendChild(footer);

        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);
    }

    startDrag(event) {
        this.dragging = true;
        this.startX = event.clientX - this.modal.offsetLeft;
        this.startY = event.clientY - this.modal.offsetTop;
        event.preventDefault(); // Prevent text selection.
    }

    onDrag(event) {
        if (this.dragging) {
            this.modal.style.left = (event.clientX - this.startX) + "px";
            this.modal.style.top = (event.clientY - this.startY) + "px";
            this.modal.style.position = 'fixed'; // Ensure the modal moves with respect to the viewport
        }
    }

    stopDrag() {
        this.dragging = false;
    }

    open() {
        this.overlay.classList.add('show');
    }

    close() {
        this.overlay.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(this.overlay);
        }, 310); // Ensure it matches the CSS transition
    }

    setContent(content) {
        const contentContainer = this.modal.querySelector('.custom-modal-content');
        contentContainer.innerHTML = '';
        contentContainer.appendChild(content);
    }
}
