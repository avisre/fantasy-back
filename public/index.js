
      // Add smooth scroll for navigation links
      document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener("click", function (e) {
          e.preventDefault();
          document.querySelector(this.getAttribute("href")).scrollIntoView({
            behavior: "smooth",
          });
        });
      });

      // Trigger fade-in animation on scroll
      const sections = document.querySelectorAll(".section, .hero");
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.style.animation = "fadeIn 1s ease-in-out forwards";
            }
          });
        },
        { threshold: 0.2 }
      );

      sections.forEach((section) => observer.observe(section));
 
