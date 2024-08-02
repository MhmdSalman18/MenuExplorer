const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const User = require('./models/User');
const Restaurant = require('./models/Restaurant');
const Menu = require('./models/Menu');
const pdf = require('html-pdf');

const app = express();

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/authDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Middleware
// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('main'));
app.use(express.static('public'));

app.set('view engine', 'ejs');
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false
}));

// Redirect root route to /login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'main', 'index.html'));
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

    if (!menuId || !mongoose.isValidObjectId(menuId)) {
        return res.status(400).send('Invalid menu ID');
    }

    try {
        const result = await Menu.deleteOne({ _id: menuId, userId });
        if (result.deletedCount === 0) {
            return res.status(404).send('Menu item not found');
        }
        res.redirect('/display_menu');
    } catch (err) {
        res.status(500).send('Internal Server Error');
    }
});

// Convert to PDF route
app.post('/convert_to_pdf', async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.redirect('/login');
    }

    const { menuId } = req.body;

    try {
        const menus = await Menu.find({ userId, menuName: menuId });
        const groupedMenu = {
            menuName: menuId,
            headings: menus.map(menu => ({
                heading: menu.heading,
                dishes: menu.dishes
            }))
        };

        const htmlContent = `
            <html>
                <head><title>${groupedMenu.menuName}</title></head>
                <body>
                    <h1>${groupedMenu.menuName}</h1>
                    ${groupedMenu.headings.map(heading => `
                        <h2>${heading.heading}</h2>
                        <ul>
                            ${heading.dishes.map(dish => `<li>${dish}</li>`).join('')}
                        </ul>
                    `).join('')}
                </body>
            </html>
        `;

        const pdfOptions = { format: 'A4' };

        pdf.create(htmlContent, pdfOptions).toBuffer((err, buffer) => {
            if (err) {
                return res.status(500).send('Error generating PDF');
            }
            res.type('pdf');
            res.send(buffer);
        });
    } catch (err) {
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
