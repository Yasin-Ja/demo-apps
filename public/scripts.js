// JavaScript function to toggle visibility of tokens and userinfo
function toggleDisplay(id) {
    const sections = ['idToken', 'accessToken', 'userInfo'];

    // Hide all sections
    sections.forEach(section => {
        document.getElementById(section).style.display = 'none';
    });

    // Show the clicked section
    document.getElementById(id).style.display = 'block';
}
