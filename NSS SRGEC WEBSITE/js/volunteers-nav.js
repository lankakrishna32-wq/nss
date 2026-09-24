(() => {
    const addVolunteersLink = () => {
        const activitiesLink = Array.from(document.querySelectorAll('header a, .header a'))
            .find((link) => link.textContent.trim().toLowerCase() === 'activities');

        if (!activitiesLink || activitiesLink.parentElement.querySelector('a[href="volunteers.html"]')) return;

        const volunteersLink = document.createElement('a');
        volunteersLink.href = 'volunteers.html';
        volunteersLink.textContent = 'Volunteers';
        volunteersLink.className = activitiesLink.className;
        volunteersLink.classList.remove('active');
        volunteersLink.removeAttribute('aria-current');
        activitiesLink.parentElement.insertBefore(volunteersLink, activitiesLink);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addVolunteersLink);
    } else {
        addVolunteersLink();
    }
})();
