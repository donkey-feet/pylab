# Destiny 2 Armor & Weapons Manager - Usage Guide

## Getting Started

1. **Open the Application**
   - Open `index.html` in your web browser
   - The application will load with a login screen

2. **Connect Your Account**
   - Click the "Login with Bungie" button
   - In a real implementation, this would redirect to Bungie's authentication system
   - For demonstration purposes, the app simulates a successful login

3. **View Your Inventory**
   - After logging in, you'll see your armor and weapons inventory
   - Items are displayed in a responsive grid layout

## Features

### Filtering
- Filter items by type (All, Armor, Weapons)
- Filter items by tier (All, Common, Uncommon, Rare, Epic, Legendary)

### Item Details
- Each item shows:
  - Name
  - Type (Armor or Weapon)
  - Tier (color-coded for easy recognition)
  - Detailed stats for each item

## Getting Your Bungie API Credentials

1. **Visit the Bungie Developer Portal**
   - Go to https://www.bungie.net/developer
   - Sign in with your Bungie.net account (or create one if you don't have one)

2. **Create a New Application**
   - Click "Create New Application"
   - Give your application a name (e.g., "Destiny 2 Inventory Manager")
   - Select the appropriate application type
   - For the redirect URL, use:
     ```
     http://localhost
     ```
     or for a more specific development setup:
     ```
     http://localhost:8080
     ```

3. **Note Your Credentials**
   - API Key (BUNGIE_API_KEY)
   - Client ID (CLIENT_ID)
   - Redirect URL (REDIRECT_URL)

## Configuring the Application

1. Open the `config.js` file in your project directory
2. Replace the placeholder values with your actual Bungie credentials:
   ```javascript
   // config.js
   const BUNGIE_API_KEY = 'YOUR_ACTUAL_BUNGIE_API_KEY';
   const CLIENT_ID = 'YOUR_ACTUAL_CLIENT_ID';
   const REDIRECT_URL = 'YOUR_ACTUAL_REDIRECT_URL';
   ```

## Running the Application

1. Open `index.html` in a web browser
2. Click the "Login with Bungie" button
3. You will be redirected to Bungie's authentication page
4. Log in with your Bungie.net credentials and authorize the application
5. You will be redirected back to our application
6. Your inventory data will be displayed

## Important Security Notes

- Never commit your `config.js` file to version control (it's already in .gitignore)
- The application stores tokens temporarily in localStorage for demonstration purposes
- In production, implement proper token management and secure storage

## Troubleshooting

### Common Issues

1. **"Invalid redirect_uri" error**
   - Make sure your redirect URI matches exactly what you registered in the Bungie Developer Portal
   - Try using `http://localhost` as the redirect URI for local development

2. **Authentication fails**
   - Verify that all credentials are correct
   - Check that you're using the correct OAuth flow for your application type

3. **Inventory not loading**
   - Ensure you have proper API permissions
   - Verify that your API key is valid and active

## Development Notes

This is a frontend demonstration of how a Destiny 2 inventory manager would work. In a production environment, you would need:

### Required Setup
1. **Bungie API Key**
   - Get one from [Bungie Developer Portal](https://www.bungie.net/developer)
   - Register your application to get credentials

2. **OAuth Authentication**
   - Implement proper Bungie OAuth flow
   - Handle token refresh and storage securely

3. **Backend Server**
   - A server to handle API requests (due to CORS restrictions)
   - Secure handling of API keys and tokens

### Technical Implementation
The current implementation uses:
- HTML5 for structure
- CSS3 for styling with responsive design
- JavaScript for interactivity and data handling
- Mock data for demonstration purposes

## Future Enhancements

1. **Real Bungie API Integration**
   - Connect to actual Bungie endpoints
   - Handle authentication properly

2. **Advanced Features**
   - Item comparison tool
   - Inventory optimization suggestions
   - Character-specific views
   - Wishlist functionality

3. **Performance Improvements**
   - Lazy loading of images
   - Caching strategies
   - Data compression

## Troubleshooting

### Common Issues
- **CORS Errors**: These are expected in the frontend-only demo. A backend is required for real API calls.
- **Authentication Failures**: In a real implementation, ensure proper OAuth flow and token handling.

### Browser Compatibility
The application works best in modern browsers (Chrome, Firefox, Edge, Safari).

## License

This project is created for educational purposes. Please respect Bungie's API usage policies and terms of service.