(function () {
    const banner = document.createElement('div');
    banner.id = 'js-injector-test';
    banner.textContent = 'JavaScript Injector is working';
    banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 999999;
        padding: 15px;
        background: red;
        color: white;
        font-size: 20px;
        text-align: center;
    `;
    document.body.appendChild(banner);
})();