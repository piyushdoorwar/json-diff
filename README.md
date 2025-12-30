# JSON Diff Studio

A sleek, desktop-optimized web application for comparing JSON documents with intelligent diff highlighting and formatting tools.

## Features

- **Dual JSON Editors**: Paste or type JSON in two side-by-side CodeMirror editors with line numbers
- **Smart Formatting**: Beautify JSON with customizable indentation (spaces or tabs)
- **Intelligent Diffing**: Compare JSON objects and highlight differences:
  - 🔴 **Missing values** (red)
  - 🟢 **Added values** (green)
  - 🔵 **Minor/time-based changes** (blue)
  - 🟠 **Structural updates** (orange)
- **Code Editor Features**: Syntax highlighting, auto-close brackets, bracket matching, and line wrapping
- **Responsive Design**: Optimized for desktop screens with a modern dark theme
- **Merged JSON View**: Displays a unified JSON document with inline color coding for changes, plus options to sort keys alphabetically and transform key casing (camelCase, PascalCase, snake_case, kebab-case, UPPER_CASE)
- **Comparison Timeline**: Detailed list of all differences with contextual information

## Usage

1. Open `index.html` in your web browser
2. Paste your original JSON in the left editor
3. Paste the modified JSON in the right editor
4. Use the "Format" buttons to beautify individual editors or "Beautify both" for both
5. Adjust indentation settings as needed (size and type)
6. Click "Compare JSON" to see the differences

## Project Structure

```
json-diff/
├── index.html      # Main HTML file
├── styles.css      # CSS styles
├── script.js       # JavaScript functionality
└── README.md       # This file
```

## Development

This is a static web application with no build process required. Simply open `index.html` in any modern web browser.

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd json-diff

# Open in browser
open index.html
```

## Deployment

This project is configured for deployment to Firebase Hosting via GitHub Actions. The workflow automatically deploys on pushes to the main branch.

### Firebase Setup

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```
2. Login to Firebase:
   ```bash
   firebase login
   ```
3. Create a Firebase project at https://console.firebase.google.com/
4. Initialize Firebase Hosting in your project:
   ```bash
   firebase init hosting
   ```
   (Select your project and use the default settings - the `firebase.json` is already configured)
5. Generate a Firebase CI token:
   ```bash
   firebase login:ci
   ```
6. Add the token as a GitHub secret named `FIREBASE_TOKEN`
7. Add your Firebase project ID as a GitHub secret named `FIREBASE_PROJECT`

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - see LICENSE file for details