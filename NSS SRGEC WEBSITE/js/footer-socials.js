(() => {
    const networks = [
        { name: 'whatsapp', label: 'WhatsApp Channel', symbol: '◉' },
        { name: 'linkedin', label: 'LinkedIn', symbol: 'in' },
        { name: 'facebook', label: 'Facebook', symbol: 'f' }
    ];

    const linksFrom = (source) => networks.map((network) => ({
        ...network,
        href: Array.from(source.querySelectorAll('a')).find((link) =>
            link.textContent.toLowerCase().includes(network.name)
        )?.href
    }));

    const addFooterSocials = async () => {
        const footer = document.querySelector('footer');
        if (!footer || footer.querySelector('.footer-social-media')) return;
        const officeHeading = Array.from(footer.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, b'))
            .find((element) => /hamara bharat office/i.test(element.textContent));
        if (!officeHeading) return;

        let socialLinks = linksFrom(document);
        if (socialLinks.some((link) => !link.href)) {
            try {
                const response = await fetch('contact.html');
                if (response.ok) socialLinks = linksFrom(new DOMParser().parseFromString(await response.text(), 'text/html'));
            } catch (error) {
                return;
            }
        }
        if (socialLinks.some((link) => !link.href)) return;

        const block = document.createElement('div');
        block.className = 'footer-social-media';
        block.innerHTML = '<p>Follow Us</p><div class="footer-social-media__links"></div>';
        const container = block.querySelector('.footer-social-media__links');
        socialLinks.forEach((network) => {
            const link = document.createElement('a');
            link.href = network.href;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = `footer-social-media__link footer-social-media__link--${network.name}`;
            link.setAttribute('aria-label', network.label);
            link.textContent = network.symbol;
            container.appendChild(link);
        });

        const officeColumn = officeHeading.parentElement;
        const locationLine = Array.from(officeColumn.querySelectorAll('p, div, span'))
            .find((element) => element.children.length === 0 && /^location:/i.test(element.textContent.trim()));
        (locationLine || officeHeading).insertAdjacentElement('afterend', block);
    };

    const removeDuplicateSocialBlocks = () => {
        document.querySelectorAll('footer').forEach((footer) => {
            const blocks = Array.from(footer.querySelectorAll('.footer-social-media'));
            blocks.slice(1).forEach((block) => block.remove());
        });
    };

    const keepOneFooterSocialBlock = () => {
        removeDuplicateSocialBlocks();
        addFooterSocials();
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', keepOneFooterSocialBlock);
    else keepOneFooterSocialBlock();
    new MutationObserver(keepOneFooterSocialBlock).observe(document.documentElement, { childList: true, subtree: true });
})();
