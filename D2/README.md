# Destiny 2 Armor & Weapons Manager

A web application for managing your Destiny 2 armor and weapons inventory using Bungie's API.

## Features

- Login with your Bungie.net account
- View your inventory items (armor and weapons)
- Filter items by type and rarity
- Responsive design for all devices

## Getting Started

### Prerequisites

1. A Bungie.net developer account (https://www.bungie.net/developer)
2. Registered application with OAuth credentials

### Setup Instructions

1. **Create a Bungie Developer Account**
   - Visit https://www.bungie.net/developer
   - Register for an API key
   - Create a new application to get your OAuth client ID and redirect URL

2. **Configure Your Credentials**
   - Update `config.js` with your actual Bungie API credentials:
     ```javascript
     // config.js
     const BUNGIE_API_KEY = 'YOUR_ACTUAL_BUNGIE_API_KEY';
     const CLIENT_ID = 'YOUR_ACTUAL_CLIENT_ID';
     const REDIRECT_URL = 'YOUR_ACTUAL_REDIRECT_URL';
     ```

3. **Run the Application**
   - Open `index.html` in a web browser
   - Click "Login with Bungie" to connect your account

## Project Structure

```
.
├── index.html          # Main HTML structure
├── styles.css          # Styling for the application
├── script.js           # JavaScript functionality and API integration
├── config.js           # Configuration file for Bungie API credentials (keep secure!)
├── README.md           # This file
├── USAGE.md            # Detailed usage guide
├── package.json        # Project dependencies and scripts
└── tasks.json          # VS Code tasks configuration
```

## How It Works

1. User clicks "Login with Bungie"
2. Application redirects to Bungie's OAuth endpoint
3. User authenticates and authorizes the application
4. Bungie redirects back to our application with an authorization code
5. Our application exchanges the code for an access token
6. Using the access token, we fetch the user's inventory data from Bungie's API
7. Inventory data is displayed in the UI

## Security Notes

- The `config.js` file contains sensitive information and should never be committed to version control
- Access tokens are stored temporarily in localStorage for demonstration purposes only
- In a production environment, proper token management and secure storage would be required

## Development

This application uses modern JavaScript (ES6+) and vanilla HTML/CSS. No frameworks or libraries are used.

## Usage

For detailed usage instructions, please refer to [USAGE.md](USAGE.md).

## License

This project is created for educational purposes. Please respect Bungie's terms of service when using their API.
- Responsive design principles

## Future Enhancements

- Item comparison functionality
- Inventory optimization suggestions
- Character-specific inventory views
- Wishlist and favorites system
- Export/import functionality

## License

This project is created for educational purposes. Please respect Bungie's API usage policies and terms of service.