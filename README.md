# eCommerce Website Project

## Description
This project is an eCommerce website inspired by Steam, built using **SQLite**, **Node.js**, and **Bootstrap**. It provides a platform for customers to browse, purchase games, and manage their shopping cart. Developers can upload games for sale, and an admin panel handles game approval and announcements.

## Features
- **User Roles:** 
  - `User (Customer)`
    - Register and login to their account.
    - Browse and purchase games.
    - Add/remove items from their shopping cart.
    - Proceed to checkout.
  - `Dev (Developer)`
    - Register and login to their account.
    - Upload games through a `Dev Dashboard`.
    - View status of upload requests (approved/declined).
  - `Admin`
    - Manage and approve game uploads.
    - Publish announcements.
- **Game Management:**
  - Secure storage and display of game details.
- **Responsive Design:**
  - Built with Bootstrap for mobile and desktop compatibility.

## Technology Stack
- **Backend:** Node.js, Express.js
- **Database:** SQLite
- **Frontend:** Bootstrap, EJS (Embedded JavaScript)
- **File Upload:** Multer

## Setup Instructions
1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Set up the database:**
   - The database file `game_store.db` is located in the root directory.
4. **Start the server:**
   ```bash
   npm start
   ```
5. **Access the application:**
   Open a browser and navigate to `http://localhost:3000`.

## Project Structure
```
STEAM-WANNABE-MAIN/
├── public/
│   ├── images/
│   └── uploads/
├── src/
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── admin.js
│   │   ├── auth.js
│   │   ├── developer.js
│   │   ├── game.js
│   │   ├── index.js
│   │   ├── library.js
│   │   ├── payment.js
│   │   └── user.js
│   ├── utils/
│   │   └── fileUpload.js
│   ├── views/
│   │   ├── partials/
│   │   │   ├── admin_dashboard.ejs
│   │   │   ├── cart_page.ejs
│   │   │   ├── developer_dashboard.ejs
│   │   │   ├── developer_games.ejs
│   │   │   ├── game_detail.ejs
│   │   │   ├── home.ejs
│   │   │   ├── library_page.ejs
│   │   │   ├── login_page.ejs
│   │   │   ├── payment_page.ejs
│   │   │   ├── register_page.ejs
│   │   │   └── user_dashboard.ejs
│   ├── app.js
├── .gitignore
├── game_store.db
├── package-lock.json
├── package.json
└── server.js
```

## Middleware
The project includes authentication middleware for access control:
- **`isAuthenticated`**: Ensures the user is logged in.
- **`isAdmin`**: Grants access only to admin users.
- **`isDeveloper`**: Grants access only to developer users.

## Routes
### Authentication Routes
- **GET** `/register` - Render the registration page.
- **POST** `/register` - Register a new user or developer.
- **GET** `/login` - Render the login page.
- **POST** `/login` - Authenticate a user.
- **GET** `/logout` - Log out the current user.

### Admin Routes
- **GET** `/admin` - View pending game uploads (Admin only).
- **POST** `/admin/action` - Approve or decline uploaded games.

### Developer Routes
- **GET** `/developer-dashboard` - View developer wallet and dashboard.
- **POST** `/upload-game` - Upload a new game (requires file upload).
- **GET** `/developer-games` - View developer's uploaded games.

### User Routes
- **GET** `/dashboard` - User dashboard to view approved games.
- **POST** `/cart/add` - Add a game to the shopping cart.
- **POST** `/cart/remove` - Remove a game from the cart.
- **GET** `/cart` - View cart details.
- **POST** `/cart/checkout` - Proceed to checkout.
- **POST** `/cart/confirm-payment` - Confirm payment and complete purchase.

### Game and Library Routes
- **GET** `/game/:id` - View details of a specific game.
- **GET** `/library` - View purchased games with advanced filtering.

### Index Routes
- **GET** `/` - Render the home page.

## File Upload
The file upload functionality is handled using **Multer**:
- Uploaded images are saved to the `public/uploads/` directory.
- Only `.png` files are accepted.

## Future Enhancements
- Implement payment gateway integration.
- Add user reviews and ratings for games.
- Introduce game categories and search functionality.

## Contributors
- [Your Name](#): CEO and Lead Developer
- Contributions are welcome! Please submit a pull request.

## License
This project is licensed under the MIT License. See the `LICENSE` file for more details.

---

Thank you for checking out this project! If you have any questions or feedback, feel free to reach out.
