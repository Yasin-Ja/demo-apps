const express = require('express');
const { Issuer } = require('openid-client');
const session = require('express-session');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'your_secret',
  resave: false,
  saveUninitialized: true,
}));

// Serve static files (CSS and JS)
app.use(express.static('public'));

let client;

// Route to display form to input client details
app.get('/', async (req, res) => {
  if (!req.session.tokenSet) {
    if (!req.session.clientConfigured) {
      res.send(`
        <html>
        <head>
          <link rel="stylesheet" href="/styles.css">
        </head>
        <body>
          <div class="container">
            <h2>Configure OIDC Client</h2>
            <form action="/configure" method="post">
              <label for="discoveryUrl">OIDC Discovery URL:</label>
              <input type="text" id="discoveryUrl" name="discoveryUrl" value="https://your-oidc-provider/.well-known/openid-configuration">

              <label for="clientId">Client ID:</label>
              <input type="text" id="clientId" name="clientId">

              <label for="clientSecret">Client Secret:</label>
              <input type="text" id="clientSecret" name="clientSecret">

              <label for="redirectUri">Redirect URI:</label>
              <input type="text" id="redirectUri" name="redirectUri" value="http://localhost:3000/callback">

              <input type="submit" value="Configure OIDC Client">
            </form>
          </div>
        </body>
        </html>
      `);
    } else {
      res.send('<a href="/login">Login with OIDC</a>');
    }
  } else {
    const idToken = req.session.tokenSet.id_token;
    const accessToken = req.session.tokenSet.access_token;

    const decodedIdToken = jwt.decode(idToken);
    const decodedAccessToken = jwt.decode(accessToken);

    try {
      const userInfo = await client.userinfo(accessToken);
      console.log('Userinfo:', userInfo);

      res.send(`
        <html>
        <head>
          <link rel="stylesheet" href="/styles.css">
        </head>
        <body>
          <div class="container">
            <h1>Hello ${decodedIdToken ? decodedIdToken.sub : 'Unknown User'}</h1>

            <button onclick="toggleDisplay('idToken')">Show ID Token</button>
            <button onclick="toggleDisplay('accessToken')">Show Access Token</button>
            <button onclick="toggleDisplay('userInfo')">Show User Info</button>

            <div id="idToken" class="token-section">
              <h2>ID Token</h2>
              <pre>${JSON.stringify(decodedIdToken, null, 2)}</pre>
            </div>

            <div id="accessToken" class="token-section">
              <h2>Access Token</h2>
              <pre>${JSON.stringify(decodedAccessToken, null, 2)}</pre>
            </div>

            <div id="userInfo" class="token-section">
              <h2>User Info</h2>
              <pre>${JSON.stringify(userInfo, null, 2)}</pre>
            </div>

            <a href="/logout">Logout</a>

            <script src="/scripts.js"></script>
          </div>
        </body>
        </html>
      `);
    } catch (err) {
      console.error('Error fetching userinfo:', err);
      res.status(500).send('Failed to fetch userinfo.');
    }
  }
});

// Handle form submission to configure OIDC client
app.post('/configure', (req, res) => {
  const { discoveryUrl, clientId, clientSecret, redirectUri } = req.body;

  Issuer.discover(discoveryUrl).then((issuer) => {
    client = new issuer.Client({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: [redirectUri],
      response_types: ['code'],
    });

    req.session.clientConfigured = true;
    req.session.redirectUri = redirectUri;
    res.redirect('/');
  }).catch((err) => {
    console.error('Error configuring OIDC client:', err);
    res.status(500).send('Failed to configure OIDC client. Check your inputs and try again.');
  });
});

app.get('/login', (req, res) => {
  const authorizationUrl = client.authorizationUrl({
    scope: 'openid email profile',
  });
  res.redirect(authorizationUrl);
});

app.get('/callback', (req, res) => {
  const params = client.callbackParams(req);
  client.callback(req.session.redirectUri, params).then((tokenSet) => {
    req.session.tokenSet = tokenSet;
    res.redirect('/');
  }).catch((err) => {
    console.error('Error during callback:', err);
    res.status(500).send('Login failed');
  });
});

app.get('/logout', (req, res) => {
  if (client) {
    const endSessionUrl = client.endSessionUrl({
      id_token_hint: req.session.tokenSet.id_token,
      post_logout_redirect_uri: 'http://localhost:3000',
    });

    req.session.destroy(() => {
      res.redirect(endSessionUrl);
    });
  } else {
    req.session.destroy();
    res.redirect('/');
  }
});

app.listen(3000, () => {
  console.log('OIDC demo app listening on port 3000');
});
