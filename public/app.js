const API_BASE = `${window.location.protocol}//${window.location.host}/api`;
let authToken = localStorage.getItem('authToken');
let refreshToken = localStorage.getItem('refreshToken');
let currentUser = null;
let currentConversationId = null;
let currentFileId = null;
let currentView = 'chat'; // 'chat' or 'file'

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded fired');
    
    // Check authentication status
    if (authToken) {
        checkAuthAndInitialize();
    } else {
        showAuthScreen();
    }
    
    setupAuthEventListeners();
    setupMainAppEventListeners();
});

// Authentication functions
function setupAuthEventListeners() {
    // Auth tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            switchAuthTab(this.dataset.form);
        });
    });
    
    // Login form
    document.getElementById('login-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        await login(email, password);
    });
    
    // Register form
    document.getElementById('register-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;
        
        if (password !== confirm) {
            showError('register-error', 'Passwords do not match');
            return;
        }
        
        await register(name, email, password);
    });
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

function setupMainAppEventListeners() {
    // Add other event listeners
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshConversations);
    }
    
    const sendButton = document.getElementById('sendButton');
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }
    
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keydown', handleKeyDown);
    }
    
    const refreshFilesBtn = document.getElementById('refreshFilesBtn');
    if (refreshFilesBtn) {
        refreshFilesBtn.addEventListener('click', refreshFiles);
    }
    
    const backToChatBtn = document.getElementById('backToChatBtn');
    if (backToChatBtn) {
        backToChatBtn.addEventListener('click', showChatView);
    }
    
    const newConversationBtn = document.getElementById('newConversationBtn');
    if (newConversationBtn) {
        newConversationBtn.addEventListener('click', function() {
            console.log('Button clicked!');
            createNewConversation();
        });
    }
    
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
}

async function checkAuthAndInitialize() {
    try {
        const response = await apiCall(`${API_BASE}/auth/me`);
        currentUser = response.user;
        showMainApp();
        refreshConversations();
    } catch (error) {
        console.error('Auth check failed:', error);
        logout();
    }
}

function showAuthScreen() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
}

function showMainApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    
    // Clear any previous user's UI state
    clearAllUIState();
    
    if (currentUser) {
        document.getElementById('user-name').textContent = currentUser.name || 'User';
        document.getElementById('user-email').textContent = currentUser.email;
    }
}

function switchAuthTab(formType) {
    // Update tab buttons
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-form="${formType}"]`).classList.add('active');
    
    // Update forms
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    document.getElementById(`${formType}-form`).classList.add('active');
    
    // Clear errors
    clearAuthErrors();
}

async function login(email, password) {
    try {
        const button = document.querySelector('#login-form .auth-button');
        button.disabled = true;
        button.textContent = 'Logging in...';
        
        clearAuthErrors();
        
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }
        
        // Store tokens and user data
        authToken = data.token;
        refreshToken = data.refreshToken;
        currentUser = data.user;
        
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('refreshToken', refreshToken);
        
        showMainApp();
        refreshConversations();
        
    } catch (error) {
        console.error('Login error:', error);
        showError('login-error', error.message);
    } finally {
        const button = document.querySelector('#login-form .auth-button');
        button.disabled = false;
        button.textContent = 'Login';
    }
}

async function register(name, email, password) {
    try {
        const button = document.querySelector('#register-form .auth-button');
        button.disabled = true;
        button.textContent = 'Creating account...';
        
        clearAuthErrors();
        
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }
        
        // Store tokens and user data
        authToken = data.token;
        refreshToken = data.refreshToken;
        currentUser = data.user;
        
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('refreshToken', refreshToken);
        
        showMainApp();
        refreshConversations();
        
    } catch (error) {
        console.error('Register error:', error);
        showError('register-error', error.message);
    } finally {
        const button = document.querySelector('#register-form .auth-button');
        button.disabled = false;
        button.textContent = 'Register';
    }
}

function logout() {
    authToken = null;
    refreshToken = null;
    currentUser = null;
    currentConversationId = null;
    currentFileId = null;
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    
    // Clear all UI state
    clearAllUIState();
    
    showAuthScreen();
    
    // Clear forms
    document.querySelectorAll('input').forEach(input => {
        if (input.type !== 'submit') input.value = '';
    });
    
    clearAuthErrors();
}

function clearAllUIState() {
    // Clear chat messages
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <p>Welcome to RunStrong AI! 🏃‍♂️</p>
                <p>Create a new conversation to start chatting with your AI running coach.</p>
                <p>I can help you with training plans, running advice, and track your progress using the 7 pillars of RunStrong training.</p>
            </div>
        `;
    }
    
    // Clear chat title and subtitle
    const chatTitle = document.getElementById('chatTitle');
    const chatSubtitle = document.getElementById('chatSubtitle');
    if (chatTitle) chatTitle.textContent = 'Select a conversation';
    if (chatSubtitle) chatSubtitle.textContent = 'Create a new conversation or select an existing one';
    
    // Clear conversations list
    const conversationsList = document.getElementById('conversationsList');
    if (conversationsList) {
        conversationsList.innerHTML = '<div class="loading">Loading conversations...</div>';
    }
    
    // Clear files list
    const filesList = document.getElementById('filesList');
    if (filesList) {
        filesList.innerHTML = '<div class="loading">Loading files...</div>';
    }
    
    // Clear file viewer
    const fileContent = document.getElementById('fileContent');
    const fileTitle = document.getElementById('fileTitle');
    const fileSubtitle = document.getElementById('fileSubtitle');
    if (fileContent) {
        fileContent.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <p>📄 File Viewer</p>
                <p>Select a training file from the sidebar to view its contents.</p>
                <p>Files are automatically created by RunStrong AI as you chat about your training.</p>
            </div>
        `;
    }
    if (fileTitle) fileTitle.textContent = 'Select a file';
    if (fileSubtitle) fileSubtitle.textContent = 'Choose a file from the sidebar to view its contents';
    
    // Reset to chat view
    showChatView();
    
    // Clear message input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) messageInput.value = '';
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function clearAuthErrors() {
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('register-error').style.display = 'none';
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function apiCall(url, options = {}) {
    if (!authToken && !url.includes('/auth/')) {
        throw new Error('No authentication token available');
    }
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (authToken && !url.includes('/auth/login') && !url.includes('/auth/register')) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const response = await fetch(url, {
        headers,
        ...options
    });
    
    if (response.status === 401 && !url.includes('/auth/')) {
        // Try to refresh token
        if (refreshToken) {
            try {
                await refreshAuthToken();
                // Retry original request
                headers['Authorization'] = `Bearer ${authToken}`;
                const retryResponse = await fetch(url, { headers, ...options });
                if (!retryResponse.ok) {
                    const error = await retryResponse.json();
                    throw new Error(error.error || 'API call failed');
                }
                return retryResponse.json();
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                logout();
                throw new Error('Authentication expired');
            }
        } else {
            logout();
            throw new Error('Authentication required');
        }
    }
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API call failed');
    }
    
    return response.json();
}

async function refreshAuthToken() {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
    });
    
    if (!response.ok) {
        throw new Error('Token refresh failed');
    }
    
    const data = await response.json();
    authToken = data.token;
    refreshToken = data.refreshToken;
    
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('refreshToken', refreshToken);
}

async function createNewConversation() {
    console.log('createNewConversation called');
    try {
        console.log('API_BASE:', API_BASE);
        
        const result = await apiCall(`${API_BASE}/coach/conversations`, {
            method: 'POST',
            body: JSON.stringify({
                title: 'New Training Session'
            })
        });
        
        console.log('API result:', result);
        
        currentConversationId = result.id;
        document.getElementById('chatTitle').textContent = result.title;
        document.getElementById('chatSubtitle').textContent = `Created ${new Date(result.createdAt).toLocaleString()}`;
        document.getElementById('chatMessages').innerHTML = '';
        
        refreshConversations();
        document.getElementById('messageInput').focus();
    } catch (error) {
        console.error('Error creating conversation:', error);
        showError('Failed to create conversation: ' + error.message);
    }
}

async function refreshConversations() {
    try {
        const result = await apiCall(`${API_BASE}/coach/conversations`);
        
        const list = document.getElementById('conversationsList');
        if (result.conversations.length === 0) {
            list.innerHTML = '<p style="color: #666; text-align: center;">No conversations yet</p>';
            return;
        }
        
        list.innerHTML = result.conversations.map(conv => `
            <div class="conversation-item ${conv.id === currentConversationId ? 'active' : ''}" 
                 data-conversation-id="${conv.id}">
                <div class="conversation-title">${conv.title}</div>
                <div class="conversation-meta">
                    ${conv.messageCount} messages • ${new Date(conv.updatedAt).toLocaleDateString()}
                </div>
            </div>
        `).join('');
        
        // Add click listeners to conversation items
        list.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', function() {
                const conversationId = this.getAttribute('data-conversation-id');
                loadConversation(conversationId);
            });
        });
    } catch (error) {
        document.getElementById('conversationsList').innerHTML = 
            `<div class="error">Failed to load conversations: ${error.message}</div>`;
    }
}

async function loadConversation(conversationId) {
    try {
        const result = await apiCall(`${API_BASE}/coach/conversations/${conversationId}`);
        
        currentConversationId = conversationId;
        document.getElementById('chatTitle').textContent = result.title;
        document.getElementById('chatSubtitle').textContent = 
            `${result.messages.length} messages • Updated ${new Date(result.updatedAt).toLocaleString()}`;
        
        const messagesDiv = document.getElementById('chatMessages');
        messagesDiv.innerHTML = result.messages.map(msg => `
            <div class="message ${msg.role}">
                ${formatMessage(msg.content)}
            </div>
        `).join('');
        
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        refreshConversations(); // Update sidebar
    } catch (error) {
        showError('Failed to load conversation: ' + error.message);
    }
}

async function sendMessage() {
    console.log('Send message clicked, currentConversationId:', currentConversationId);
    if (!currentConversationId) {
        showError('Please create or select a conversation first');
        return;
    }
    
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (!message) return;
    
    const sendButton = document.getElementById('sendButton');
    sendButton.disabled = true;
    sendButton.textContent = 'Sending...';
    messageInput.disabled = true;
    
    // Add user message to UI immediately
    addMessageToUI('user', message);
    messageInput.value = '';
    
    try {
        const result = await apiCall(`${API_BASE}/coach/conversations/${currentConversationId}/messages`, {
            method: 'POST',
            body: JSON.stringify({
                message: message
            })
        });
        
        // Add assistant response to UI
        addMessageToUI('assistant', result.response);
        refreshConversations(); // Update message count
        
    } catch (error) {
        showError('Failed to send message: ' + error.message);
    } finally {
        sendButton.disabled = false;
        sendButton.textContent = 'Send';
        messageInput.disabled = false;
        messageInput.focus();
    }
}

function addMessageToUI(role, content) {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.innerHTML = formatMessage(content);
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function formatMessage(content) {
    // Basic markdown formatting
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>')
        .replace(/`(.*?)`/g, '<code>$1</code>');
}

function showError(message) {
    const messagesDiv = document.getElementById('chatMessages');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    messagesDiv.appendChild(errorDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Tab and view management
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Load data for the tab
    if (tabName === 'files') {
        refreshFiles();
    } else if (tabName === 'conversations') {
        refreshConversations();
    }
}

function showChatView() {
    document.getElementById('chat-view').style.display = 'flex';
    document.getElementById('file-view').style.display = 'none';
    currentView = 'chat';
}

function showFileView() {
    document.getElementById('chat-view').style.display = 'none';
    document.getElementById('file-view').style.display = 'flex';
    currentView = 'file';
}

// File management functions
async function refreshFiles() {
    try {
        const result = await apiCall(`${API_BASE}/coach/files`);
        
        const list = document.getElementById('filesList');
        if (result.files.length === 0) {
            list.innerHTML = '<p style="color: #666; text-align: center;">No files yet<br><small>Files are created automatically as you chat with the AI</small></p>';
            return;
        }
        
        list.innerHTML = result.files.map(file => `
            <div class="file-item ${file.id === currentFileId ? 'active' : ''}" 
                 data-file-id="${file.id}">
                <div class="file-name">${file.fileName}</div>
                <div class="file-meta">
                    ${file.fileType} • ${formatFileSize(file.size)} • ${new Date(file.updatedAt).toLocaleDateString()}
                </div>
            </div>
        `).join('');
        
        // Add click listeners to file items
        list.querySelectorAll('.file-item').forEach(item => {
            item.addEventListener('click', function() {
                const fileId = this.getAttribute('data-file-id');
                const fileName = this.querySelector('.file-name').textContent;
                loadFile(fileId, fileName);
            });
        });
    } catch (error) {
        document.getElementById('filesList').innerHTML = 
            `<div class="error">Failed to load files: ${error.message}</div>`;
    }
}

async function loadFile(fileId, fileName) {
    try {
        const result = await apiCall(`${API_BASE}/coach/files/${fileName}`);
        
        currentFileId = fileId;
        document.getElementById('fileTitle').textContent = fileName;
        document.getElementById('fileSubtitle').textContent = 
            `Last updated: ${new Date().toLocaleDateString()}`;
        
        const contentDiv = document.getElementById('fileContent');
        
        // Determine content type and apply appropriate formatting
        if (fileName.endsWith('.md') || fileName.endsWith('.markdown')) {
            contentDiv.className = 'file-content markdown';
            contentDiv.innerHTML = formatMarkdown(result.content);
        } else if (fileName.endsWith('.json')) {
            contentDiv.className = 'file-content';
            contentDiv.textContent = JSON.stringify(result.content, null, 2);
        } else {
            contentDiv.className = 'file-content';
            contentDiv.textContent = result.content;
        }
        
        // Update file list to show active file
        refreshFiles();
        
        // Switch to file view
        showFileView();
    } catch (error) {
        showError('Failed to load file: ' + error.message);
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatMarkdown(content) {
    // Basic markdown formatting for display
    return content
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/^- \[ \] (.*$)/gm, '<div>☐ $1</div>')
        .replace(/^- \[x\] (.*$)/gm, '<div>☑ $1</div>')
        .replace(/^- (.*$)/gm, '<div>• $1</div>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
}