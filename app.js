const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const User = require('./models/User');
const Restaurant = require('./models/Restaurant'); // Import the Restaurant model
const Menu = require('./models/Menu'); // Import the Menu model

const app = express();

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/authDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false
}));

// Redirect root route to /login
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Login route
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user) {
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                req.session.userId = user._id;
                res.redirect('/choose_menu'); // Redirect to choose_menu page
            } else {
                res.send('Incorrect password!');
            }
        } else {
            res.send('No user found with this email!');
        }
    } catch (err) {
        res.status(500).send('Internal Server Error');
    }
});

// Signup route
app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            name,
            email,
            password: hashedPassword
        });
        await newUser.save();
        res.send('User signed up!');
    } catch (err) {
        res.status(500).send('Error signing up!');
    }
});

// Choose Menu route
app.get('/choose_menu', async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.redirect('/login'); // Redirect to login if not authenticated
    }
    res.render('choose_menu');
});

app.post('/choose_menu', async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.redirect('/login'); // Redirect to login if not authenticated
    }

    const { heading, ...dishes } = req.body;
    const menuData = [];

    // Find the count of menus already created by the user
    const menuCount = await Menu.countDocuments({ userId });

    // Generate a unique menu name
    const menuName = `Menu ${menuCount + 1}`;

    for (let i = 0; i < heading.length; i++) {
        menuData.push({
            userId,
            menuName,
            heading: heading[i],
            dishes: dishes[`dish-${i + 1}`] // dishes under each heading
        });
    }

    try {
        await Menu.insertMany(menuData);
        res.redirect('/display_menu'); // Redirect to display_menu page
    } catch (err) {
        res.status(500).send('Internal Server Error');
    }
});


// Display Menu route
app.get('/display_menu', async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.redirect('/login'); // Redirect to login if not authenticated
    }

    try {
        const menus = await Menu.find({ userId }).sort('menuName');
        const groupedMenus = menus.reduce((acc, menu) => {
            if (!acc[menu.menuName]) {
                acc[menu.menuName] = {
                    menuName: menu.menuName,
                    headings: []
                };
            }
            acc[menu.menuName].headings.push({
                heading: menu.heading,
                dishes: menu.dishes
            });
            return acc;
        }, {});

        res.render('display_menu', { menus: Object.values(groupedMenus) });
    } catch (err) {
        res.status(500).send('Internal Server Error');
    }
});

// Delete Menu route
app.post('/delete_menu', async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.redirect('/login'); // Redirect to login if not authenticated
    }

    const { menuId } = req.body;
    console.log('Received menuId:', menuId); // Debugging line
    console.log('UserId:', userId); // Debugging line

    if (!menuId) {
        console.error('menuId is missing');
        return res.status(400).send('Menu ID is required');
    }

    // Validate the ObjectId
    if (!mongoose.isValidObjectId(menuId)) {
        console.error('Invalid menuId:', menuId);
        return res.status(400).send('Invalid menu ID');
    }

    try {
        const result = await Menu.deleteOne({ _id: menuId, userId });
        console.log('Delete Result:', result);
        if (result.deletedCount === 0) {
            console.log('No menu item found to delete.');
            return res.status(404).send('Menu item not found');
        }
        res.redirect('/display_menu');
    } catch (err) {
        console.error('Error deleting menu:', err);
        res.status(500).send('Internal Server Error');
    }
});


// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Error logging out!');
        }
        res.redirect('/login');
    });
});

app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});
