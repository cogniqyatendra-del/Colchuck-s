document.addEventListener('DOMContentLoaded', () => {
    // Helper function to get scroll position (works with both window and body scrolling)
    const getScrollTop = () => {
        return window.scrollY || window.pageYOffset || 
               document.documentElement.scrollTop || 
               document.body.scrollTop || 0;
    };

    // Navbar Scroll Effect
    const navbar = document.querySelector('.custom-navbar');
    
    const handleScroll = () => {
        if (getScrollTop() > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    };

    // Listen to scroll on window and document 
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial check in case page is loaded mid-scroll
    handleScroll();

    // Smooth Scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});
