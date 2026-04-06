require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3001/auth/linkedin/callback';
const LINKEDIN_COMPANY_ID = process.env.LINKEDIN_COMPANY_ID;
const LI_VERSION = '202504';

function liHeaders(accessToken, extra = {}) {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'LinkedIn-Version': LI_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    ...extra
  };
}

// Generate OAuth2 authorization URL
function getAuthUrl(includeOrgScope = false) {
  const scopes = includeOrgScope
    ? 'openid profile w_member_social w_organization_social'
    : 'openid profile w_member_social';
  const state = Math.random().toString(36).substring(7);
  return {
    url: `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}&state=${state}`,
    state
  };
}

// Exchange authorization code for access token
async function getAccessToken(code) {
  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
      redirect_uri: LINKEDIN_REDIRECT_URI
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LinkedIn token error: ${response.status} - ${err}`);
  }

  return response.json();
}

// Get user profile - try multiple endpoints
async function getProfile(accessToken) {
  // Try versioned /me endpoint
  let response = await fetch('https://api.linkedin.com/v2/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (response.ok) {
    const data = await response.json();
    return {
      sub: data.id,
      name: `${data.localizedFirstName || ''} ${data.localizedLastName || ''}`.trim()
    };
  }

  // Try REST /me
  response = await fetch('https://api.linkedin.com/rest/me', {
    headers: liHeaders(accessToken)
  });

  if (response.ok) {
    const data = await response.json();
    return {
      sub: data.id,
      name: `${data.localizedFirstName || ''} ${data.localizedLastName || ''}`.trim()
    };
  }

  // If all fail, return null sub (will use /me at publish time)
  console.log('Profile fetch failed, will resolve at publish time');
  return { sub: null, name: 'Connected' };
}

// Resolve person URN from token if we don't have sub
async function resolvePersonUrn(accessToken, personSub) {
  if (personSub) return `urn:li:person:${personSub}`;

  // Use /v2/me to get the person ID
  const response = await fetch('https://api.linkedin.com/v2/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (response.ok) {
    const data = await response.json();
    return `urn:li:person:${data.id}`;
  }

  throw new Error('Cannot resolve LinkedIn person ID. Please reconnect LinkedIn.');
}

// Upload image to LinkedIn
async function uploadImage(accessToken, imageBase64, ownerUrn) {
  // Step 1: Register upload
  const registerRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers: liHeaders(accessToken),
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: ownerUrn
      }
    })
  });

  if (!registerRes.ok) {
    const err = await registerRes.text();
    throw new Error(`LinkedIn image register error: ${registerRes.status} - ${err}`);
  }

  const registerData = await registerRes.json();
  const uploadUrl = registerData.value.uploadUrl;
  const imageUrn = registerData.value.image;

  // Step 2: Upload the image binary
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(base64Data, 'base64');

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream'
    },
    body: imageBuffer
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`LinkedIn image upload error: ${uploadRes.status} - ${err}`);
  }

  return imageUrn;
}

// Check if token has organization scope by trying to introspect
async function checkOrgAccess(accessToken) {
  if (!LINKEDIN_COMPANY_ID) return false;
  try {
    // Try fetching org info - if it works, we have org access
    const response = await fetch(`https://api.linkedin.com/rest/organizationsLookup?q=organizationIds&organizationIds=List(${LINKEDIN_COMPANY_ID})`, {
      headers: liHeaders(accessToken)
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Publish a post - tries company page first, falls back to personal
async function publishPost(accessToken, content, imageBase64 = null, personSub = null, postAsCompany = true) {
  let authorUrn;

  if (postAsCompany && LINKEDIN_COMPANY_ID) {
    // Check if we actually have org access before trying
    const hasOrgAccess = await checkOrgAccess(accessToken);
    if (hasOrgAccess) {
      authorUrn = `urn:li:organization:${LINKEDIN_COMPANY_ID}`;
    } else {
      console.log('No org access, posting as personal profile');
      authorUrn = await resolvePersonUrn(accessToken, personSub);
    }
  } else {
    authorUrn = await resolvePersonUrn(accessToken, personSub);
  }

  const postBody = {
    author: authorUrn,
    commentary: content,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: []
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false
  };

  // If we have an image, upload it first and attach
  if (imageBase64 && imageBase64.startsWith('data:')) {
    try {
      const imageUrn = await uploadImage(accessToken, imageBase64, authorUrn);
      postBody.content = {
        media: {
          title: 'Post Image',
          id: imageUrn
        }
      };
    } catch (err) {
      console.error('Image upload failed, posting without image:', err.message);
    }
  }

  let response = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: liHeaders(accessToken),
    body: JSON.stringify(postBody)
  });

  // If company page post fails (no org scope), fallback to personal profile
  if (!response.ok && postAsCompany && personSub) {
    const errText = await response.text();
    console.log('Company page post failed, falling back to personal:', errText.substring(0, 200));

    const personalUrn = await resolvePersonUrn(accessToken, personSub);
    postBody.author = personalUrn;

    // Re-upload image with personal owner if needed
    if (imageBase64 && imageBase64.startsWith('data:') && postBody.content) {
      try {
        const imageUrn = await uploadImage(accessToken, imageBase64, personalUrn);
        postBody.content.media.id = imageUrn;
      } catch (e) {
        delete postBody.content;
      }
    }

    response = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: liHeaders(accessToken),
      body: JSON.stringify(postBody)
    });
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LinkedIn publish error: ${response.status} - ${err}`);
  }

  const postId = response.headers.get('x-restli-id') || '';
  return { success: true, postId };
}

module.exports = {
  getAuthUrl,
  getAccessToken,
  getProfile,
  publishPost,
  uploadImage,
  checkOrgAccess
};
