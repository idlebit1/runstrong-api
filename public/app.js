const API_BASE = `${window.location.protocol}//${window.location.host}/api`;
let authToken = localStorage.getItem('authToken');
let refreshToken = localStorage.getItem('refreshToken');
let currentUser = null;
let currentConversationId = null;
let currentFileId = null;
let currentView = 'chat'; // 'chat' or 'file'
// File change tracking removed
let currentFileData = null; // Store current file data for debug views
let isRawView = false; // Track if showing raw markdown

// Change log functionality removed

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
        let errorMessage = error.message;
        
        // Provide more helpful error messages
        if (error.message.includes('Invalid email or password')) {
            errorMessage = 'Invalid email or password. Don\'t have an account? Click "Register" to create one.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = 'Connection error. Please check your internet connection and try again.';
        } else if (error.message.includes('server')) {
            errorMessage = 'Server error. Please try again in a moment.';
        }
        
        // Show error message
        const loginErrorElement = document.getElementById('login-error');
        if (loginErrorElement) {
            loginErrorElement.textContent = errorMessage;
            loginErrorElement.style.display = 'block';
        }
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
        let errorMessage = error.message;
        
        // Provide more helpful error messages
        if (error.message.includes('User with this email already exists')) {
            errorMessage = 'An account with this email already exists. Try logging in instead, or use a different email.';
        } else if (error.message.includes('Password must be')) {
            errorMessage = 'Password must be at least 6 characters long.';
        } else if (error.message.includes('Email and password are required')) {
            errorMessage = 'Please fill in all required fields.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = 'Connection error. Please check your internet connection and try again.';
        } else if (error.message.includes('server')) {
            errorMessage = 'Server error. Please try again in a moment.';
        }
        
        showError('register-error', errorMessage);
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
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function showSuccess(elementId, message) {
    const successElement = document.getElementById(elementId);
    if (successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
        // Auto-hide after 3 seconds
        setTimeout(() => {
            successElement.style.display = 'none';
        }, 3000);
    }
}

function clearAuthErrors() {
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('register-error').style.display = 'none';
    const successElement = document.getElementById('register-success');
    if (successElement) successElement.style.display = 'none';
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
        
        list.innerHTML = result.files.map(file => {
            return `
            <div class="file-item ${file.id === currentFileId ? 'active' : ''}" 
                 data-file-id="${file.id}">
                <div class="file-name">${file.fileName}</div>
                <div class="file-meta">
                    ${file.fileType} • ${formatFileSize(file.size)} • ${new Date(file.updatedAt).toLocaleDateString()}
                </div>
            </div>
        `;
        }).join('');
        
        // Add click listeners to file items
        list.querySelectorAll('.file-item').forEach(item => {
            item.addEventListener('click', function() {
                const fileId = this.getAttribute('data-file-id');
                const fileName = this.querySelector('.file-name').textContent.trim(); // Remove whitespace
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
        currentFileData = result; // Store file data for debug views
        isRawView = false; // Reset raw view state
        
        // File loaded
        
        // File opened
        
        document.getElementById('fileTitle').textContent = fileName;
        document.getElementById('fileSubtitle').textContent = 
            `Last updated: ${new Date().toLocaleDateString()}`;
        
        const contentDiv = document.getElementById('fileContent');
        
        // Determine content type and apply appropriate formatting
        if (fileName.trim().endsWith('.md') || fileName.trim().endsWith('.markdown')) {
            console.log('Processing markdown file:', fileName);
            console.log('Raw content:', result.content);
            
            // Store original markdown for direct editing
            originalMarkdownContent = result.content;
            
            const formattedContent = formatMarkdown(result.content);
            console.log('Formatted content:', formattedContent);
            contentDiv.className = 'file-content markdown';
            contentDiv.innerHTML = formattedContent;
            contentDiv.style.backgroundColor = '';
            contentDiv.style.border = '';
            console.log('Content div after setting innerHTML:', contentDiv.innerHTML.substring(0, 200));
        } else if (fileName.endsWith('.json')) {
            contentDiv.className = 'file-content';
            contentDiv.textContent = JSON.stringify(result.content, null, 2);
            contentDiv.style.backgroundColor = '';
            contentDiv.style.border = '';
        } else {
            contentDiv.className = 'file-content';
            contentDiv.textContent = result.content;
            contentDiv.style.backgroundColor = '';
            contentDiv.style.border = '';
        }
        
        // Show debug buttons for loaded files
        document.getElementById('viewRawBtn').style.display = 'inline-block';
        
        // Update file list to show active file (without API call)
        updateActiveFileInList();
        
        // Switch to file view
        showFileView();
    } catch (error) {
        showError('Failed to load file: ' + error.message);
    }
}

function updateActiveFileInList() {
    // Update the file list UI to show which file is active without making an API call
    const fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        if (item.getAttribute('data-file-id') === currentFileId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatMarkdown(content) {
    // First, clean up the content by removing excessive empty lines
    const cleanContent = content.replace(/\n\s*\n\s*\n/g, '\n\n'); // Replace 3+ newlines with 2
    const lines = cleanContent.split('\n');
    let html = '';
    let lineNumber = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        lineNumber++;
        
        // Skip completely empty lines
        if (line.trim() === '') {
            continue;
        }
        
        // Handle headers (make them interactive)
        if (line.match(/^# /)) {
            const text = line.replace(/^# /, '');
            // Check if heading is wrapped in strikethrough (skipped)
            let isSkipped = false;
            let displayText = text;
            if (text.match(/^~~(.*)~~$/)) {
                isSkipped = true;
                displayText = text.replace(/^~~(.*)~~$/, '$1');
            }
            
            // Extract note if present
            let noteText = '';
            const noteMatch = displayText.match(/^(.*?)\s*\[NOTE:\s*([^\]]+)\]\s*$/);
            if (noteMatch) {
                displayText = noteMatch[1].trim();
                noteText = noteMatch[2].trim();
            }
            
            const noteDisplay = noteText ? 'block' : 'none';
            const noteContent = noteText ? noteText : '';
            const skippedClass = isSkipped ? ' skipped' : '';
            const addNoteDisplay = noteText ? 'none' : 'none'; // Never show by default, controlled by actions
            
            html += `<div class="training-item${skippedClass}" data-line="${lineNumber}" data-type="heading">
                <h1 class="item-text" onclick="showItemActions(this)">${formatInlineMarkdown(displayText)}</h1>
                <div class="item-note" style="display: ${noteDisplay}; margin-left: 24px; margin-top: 4px; font-style: italic; color: #666; font-size: 14px; cursor: pointer; padding: 4px; border-radius: 3px; background-color: #f8f9fa;" onclick="editNote(this)">${noteContent}</div>
                <div class="add-note-prompt" style="display: ${addNoteDisplay}; margin-left: 24px; margin-top: 8px;">
                    <button class="add-note-btn" onclick="addNoteToItem(this)">+ Add note</button>
                </div>
            </div>`;
            continue;
        }
        if (line.match(/^## /)) {
            const text = line.replace(/^## /, '');
            // Check if heading is wrapped in strikethrough (skipped)
            let isSkipped = false;
            let displayText = text;
            if (text.match(/^~~(.*)~~$/)) {
                isSkipped = true;
                displayText = text.replace(/^~~(.*)~~$/, '$1');
            }
            
            // Extract note if present
            let noteText = '';
            const noteMatch = displayText.match(/^(.*?)\s*\[NOTE:\s*([^\]]+)\]\s*$/);
            if (noteMatch) {
                displayText = noteMatch[1].trim();
                noteText = noteMatch[2].trim();
            }
            
            const noteDisplay = noteText ? 'block' : 'none';
            const noteContent = noteText ? noteText : '';
            const skippedClass = isSkipped ? ' skipped' : '';
            
            html += `<div class="training-item${skippedClass}" data-line="${lineNumber}" data-type="heading">
                <h2 class="item-text" onclick="showItemActions(this)">${formatInlineMarkdown(displayText)}</h2>
                <div class="item-note" style="display: ${noteDisplay}; margin-left: 24px; margin-top: 4px; font-style: italic; color: #666; font-size: 14px; cursor: pointer; padding: 4px; border-radius: 3px; background-color: #f8f9fa;" onclick="editNote(this)">${noteContent}</div>
                <div class="add-note-prompt" style="display: none; margin-left: 24px; margin-top: 8px;">
                    <button class="add-note-btn" onclick="addNoteToItem(this)">+ Add note</button>
                </div>
            </div>`;
            continue;
        }
        if (line.match(/^### /)) {
            const text = line.replace(/^### /, '');
            // Check if heading is wrapped in strikethrough (skipped)
            let isSkipped = false;
            let displayText = text;
            if (text.match(/^~~(.*)~~$/)) {
                isSkipped = true;
                displayText = text.replace(/^~~(.*)~~$/, '$1');
            }
            
            // Extract note if present
            let noteText = '';
            const noteMatch = displayText.match(/^(.*?)\s*\[NOTE:\s*([^\]]+)\]\s*$/);
            if (noteMatch) {
                displayText = noteMatch[1].trim();
                noteText = noteMatch[2].trim();
            }
            
            const noteDisplay = noteText ? 'block' : 'none';
            const noteContent = noteText ? noteText : '';
            const skippedClass = isSkipped ? ' skipped' : '';
            
            html += `<div class="training-item${skippedClass}" data-line="${lineNumber}" data-type="heading">
                <h3 class="item-text" onclick="showItemActions(this)">${formatInlineMarkdown(displayText)}</h3>
                <div class="item-note" style="display: ${noteDisplay}; margin-left: 24px; margin-top: 4px; font-style: italic; color: #666; font-size: 14px; cursor: pointer; padding: 4px; border-radius: 3px; background-color: #f8f9fa;" onclick="editNote(this)">${noteContent}</div>
                <div class="add-note-prompt" style="display: none; margin-left: 24px; margin-top: 8px;">
                    <button class="add-note-btn" onclick="addNoteToItem(this)">+ Add note</button>
                </div>
            </div>`;
            continue;
        }
        
        // Handle any level of indented checkboxes (make them ALL interactive)
        if (line.match(/^(\s*)- \[(?:x| )\] /)) {
            const indent = line.match(/^(\s*)/)[1].length;
            const isChecked = line.match(/^(\s*)- \[x\] /) ? 'true' : 'false';
            let text = line.replace(/^(\s*)- \[(?:x| )\] /, '');
            const checked = isChecked === 'true';
            const checkedClass = checked ? 'checked' : 'unchecked';
            const checkedAttr = checked ? 'checked' : '';
            const marginLeft = indent * 12; // 12px per indent level
            
            // Check if text is wrapped in strikethrough (skipped)
            let isSkipped = false;
            if (text.match(/^~~(.*)~~$/)) {
                isSkipped = true;
                text = text.replace(/^~~(.*)~~$/, '$1');
            }
            
            // Extract note if present (text in [NOTE: ...] format at the end)
            let noteText = '';
            const noteMatch = text.match(/^(.*?)\s*\[NOTE:\s*([^\]]+)\]\s*$/);
            if (noteMatch) {
                text = noteMatch[1].trim();
                noteText = noteMatch[2].trim();
            }
            
            const noteDisplay = noteText ? 'block' : 'none';
            const noteContent = noteText ? noteText : '';
            const skippedClass = isSkipped ? ' skipped' : '';
            const addNoteDisplay = noteText ? 'none' : 'none'; // Never show by default, controlled by actions
            
            html += `<div class="training-item ${checkedClass}${skippedClass}" data-line="${lineNumber}" data-type="checkbox" style="margin-left: ${marginLeft}px;">
                <div class="item-row">
                    <input type="checkbox" class="item-checkbox" ${checkedAttr} onchange="toggleCheckbox(this)"> 
                    <span class="item-text" onclick="showItemActions(this)">${formatInlineMarkdown(text)}</span>
                </div>
                <div class="item-note" style="display: ${noteDisplay}; margin-left: 24px; margin-top: 4px; font-style: italic; color: #666; font-size: 14px; cursor: pointer; padding: 4px; border-radius: 3px; background-color: #f8f9fa;" onclick="editNote(this)">${noteContent}</div>
                <div class="add-note-prompt" style="display: ${addNoteDisplay}; margin-left: 24px; margin-top: 8px;">
                    <button class="add-note-btn" onclick="addNoteToItem(this)">+ Add note</button>
                </div>
            </div>`;
            continue;
        }
        
        // Handle any level of indented regular list items (make them ALL interactive)  
        if (line.match(/^(\s*)- (?!\[)/)) {
            const indent = line.match(/^(\s*)/)[1].length;
            let text = line.replace(/^(\s*)- /, '');
            const marginLeft = indent * 12; // 12px per indent level
            
            // Check if text is wrapped in strikethrough (skipped)
            let isSkipped = false;
            if (text.match(/^~~(.*)~~$/)) {
                isSkipped = true;
                text = text.replace(/^~~(.*)~~$/, '$1');
            }
            
            // Extract note if present (text in [NOTE: ...] format at the end)
            let noteText = '';
            const noteMatch = text.match(/^(.*?)\s*\[NOTE:\s*([^\]]+)\]\s*$/);
            if (noteMatch) {
                text = noteMatch[1].trim();
                noteText = noteMatch[2].trim();
            }
            
            const noteDisplay = noteText ? 'block' : 'none';
            const noteContent = noteText ? noteText : '';
            const skippedClass = isSkipped ? ' skipped' : '';
            const addNoteDisplay = noteText ? 'none' : 'none'; // Never show by default, controlled by actions
            
            html += `<div class="training-item${skippedClass}" data-line="${lineNumber}" data-type="item" style="margin-left: ${marginLeft}px;">
                <div class="item-row">
                    <span class="item-bullet">•</span>
                    <span class="item-text" onclick="showItemActions(this)">${formatInlineMarkdown(text)}</span>
                </div>
                <div class="item-note" style="display: ${noteDisplay}; margin-left: 24px; margin-top: 4px; font-style: italic; color: #666; font-size: 14px; cursor: pointer; padding: 4px; border-radius: 3px; background-color: #f8f9fa;" onclick="editNote(this)">${noteContent}</div>
                <div class="add-note-prompt" style="display: ${addNoteDisplay}; margin-left: 24px; margin-top: 8px;">
                    <button class="add-note-btn" onclick="addNoteToItem(this)">+ Add note</button>
                </div>
            </div>`;
            continue;
        }
        
        // Handle regular paragraphs (make them interactive)
        if (line.trim()) {
            // Check if text is wrapped in strikethrough (skipped)
            let isSkipped = false;
            let displayText = line;
            if (line.match(/^~~(.*)~~$/)) {
                isSkipped = true;
                displayText = line.replace(/^~~(.*)~~$/, '$1');
            }
            
            // Extract note if present
            let noteText = '';
            const noteMatch = displayText.match(/^(.*?)\s*\[NOTE:\s*([^\]]+)\]\s*$/);
            if (noteMatch) {
                displayText = noteMatch[1].trim();
                noteText = noteMatch[2].trim();
            }
            
            const noteDisplay = noteText ? 'block' : 'none';
            const noteContent = noteText ? noteText : '';
            const skippedClass = isSkipped ? ' skipped' : '';
            
            html += `<div class="training-item${skippedClass}" data-line="${lineNumber}" data-type="paragraph">
                <p class="item-text" onclick="showItemActions(this)" style="margin: 0; padding: 2px 4px; border-radius: 3px; cursor: pointer; transition: background-color 0.2s;">${formatInlineMarkdown(displayText)}</p>
                <div class="item-note" style="display: ${noteDisplay}; margin-left: 24px; margin-top: 4px; font-style: italic; color: #666; font-size: 14px; cursor: pointer; padding: 4px; border-radius: 3px; background-color: #f8f9fa;" onclick="editNote(this)">${noteContent}</div>
                <div class="add-note-prompt" style="display: none; margin-left: 24px; margin-top: 8px;">
                    <button class="add-note-btn" onclick="addNoteToItem(this)">+ Add note</button>
                </div>
            </div>`;
        }
    }
    
    return html;
}

function formatInlineMarkdown(text) {
    return text
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

// Training day interactive functions
function toggleCheckbox(checkbox) {
    const trainingItem = checkbox.closest('.training-item');
    const isChecked = checkbox.checked;
    const itemText = trainingItem.querySelector('.item-text');
    const lineNumber = trainingItem.getAttribute('data-line');
    
    // Checkbox toggled
    
    // Edit the markdown directly
    updateMarkdownLine(parseInt(lineNumber), (line) => {
        if (isChecked) {
            // Change unchecked to checked
            return line.replace(/^(\s*)- \[ \] /, '$1- [x] ');
        } else {
            // Change checked to unchecked
            return line.replace(/^(\s*)- \[x\] /, '$1- [ ] ');
        }
    });
    
    // Refresh the display and save
    refreshMarkdownDisplay();
    saveTrainingDayChanges();
    
    // Action completed
}

function showItemActions(itemText) {
    const trainingItem = itemText.closest('.training-item');
    const lineNumber = trainingItem.dataset.line;
    
    // Check if menu is already showing for this item
    const existingMenu = document.querySelector('.item-action-menu');
    if (existingMenu && existingMenu.dataset.trainingItem === lineNumber) {
        // Menu is already showing for this item, remove it
        existingMenu.remove();
        return;
    }
    
    // Remove any existing action menus
    document.querySelectorAll('.item-action-menu').forEach(menu => menu.remove());
    const rect = itemText.getBoundingClientRect();
    const checkbox = trainingItem.querySelector('.item-checkbox');
    const isChecked = checkbox ? checkbox.checked : false;
    
    const actionMenu = document.createElement('div');
    actionMenu.className = 'item-action-menu';
    actionMenu.style.position = 'fixed';
    actionMenu.style.top = (rect.bottom + 5) + 'px';
    actionMenu.style.left = rect.left + 'px';
    actionMenu.style.zIndex = '1000';
    actionMenu.style.backgroundColor = 'white';
    actionMenu.style.border = '1px solid #ccc';
    actionMenu.style.borderRadius = '8px';
    actionMenu.style.padding = '8px 0';
    actionMenu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    actionMenu.style.minWidth = '200px';
    
    // Check the current state of the item
    const isSkipped = trainingItem.classList.contains('skipped');
    const isDone = trainingItem.classList.contains('checked') || (checkbox && checkbox.checked);
    const itemType = trainingItem.dataset.type;
    const hasCheckbox = checkbox !== null || itemType === 'checkbox';
    
    // Build menu options based on item type
    let menuHTML = '';
    
    // Only show done/undo for items with checkboxes
    if (hasCheckbox) {
        if (isDone) {
            menuHTML += '<button onclick="undoItem(this)" style="display: block; width: 100%; padding: 12px 16px; border: none; background: none; text-align: left; cursor: pointer; font-size: 14px; color: #333;">↶ undo</button>';
        } else {
            menuHTML += '<button onclick="markDone(this)" style="display: block; width: 100%; padding: 12px 16px; border: none; background: none; text-align: left; cursor: pointer; font-size: 14px; color: #333;">✓ done</button>';
        }
    }
    
    // All items can be skipped/unskipped
    if (isSkipped) {
        menuHTML += '<button onclick="unskipItem(this)" style="display: block; width: 100%; padding: 12px 16px; border: none; background: none; text-align: left; cursor: pointer; font-size: 14px; color: #333;">↩️ unskip</button>';
    } else {
        menuHTML += '<button onclick="skipItem(this)" style="display: block; width: 100%; padding: 12px 16px; border: none; background: none; text-align: left; cursor: pointer; font-size: 14px; color: #333;">⏭️ skip</button>';
    }
    
    // All items can have notes - check if note already exists
    const noteElement = trainingItem.querySelector('.item-note');
    const hasNote = noteElement && noteElement.style.display !== 'none' && noteElement.textContent.trim();
    
    if (hasNote) {
        menuHTML += '<button onclick="editNoteFromMenu(this)" style="display: block; width: 100%; padding: 12px 16px; border: none; background: none; text-align: left; cursor: pointer; font-size: 14px; color: #333;">📝 edit note</button>';
    } else {
        menuHTML += '<button onclick="addNote(this)" style="display: block; width: 100%; padding: 12px 16px; border: none; background: none; text-align: left; cursor: pointer; font-size: 14px; color: #333;">📝 +note</button>';
    }
    
    actionMenu.innerHTML = menuHTML;
    
    // Store reference to the training item
    actionMenu.dataset.trainingItem = trainingItem.dataset.line;
    actionMenu.dataset.isChecked = isChecked;
    
    document.body.appendChild(actionMenu);
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!actionMenu.contains(e.target)) {
                actionMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

// Note editing functions
function editNote(noteElement) {
    // Prevent event bubbling to avoid triggering item actions
    event.stopPropagation();
    
    // Check if already editing
    if (noteElement.querySelector('.note-editor')) return;
    
    const trainingItem = noteElement.closest('.training-item');
    const lineNumber = trainingItem.getAttribute('data-line');
    const currentNoteText = noteElement.textContent.trim();
    
    // Create inline editing UI
    createNoteEditor(noteElement, lineNumber, currentNoteText);
}

function editNoteFromMenu(button) {
    const menu = button.closest('.item-action-menu');
    const lineNumber = menu.dataset.trainingItem;
    const trainingItem = document.querySelector(`[data-line="${lineNumber}"]`);
    const noteElement = trainingItem.querySelector('.item-note');
    const currentNoteText = noteElement.textContent.trim();
    
    // Edit note action
    menu.remove();
    
    // Check if already editing
    if (noteElement.querySelector('.note-editor')) return;
    
    // Create inline editing UI
    createNoteEditor(noteElement, lineNumber, currentNoteText);
}

function createNoteEditor(noteElement, lineNumber, currentText) {
    // Hide the note text and create editor
    noteElement.style.display = 'none';
    
    // Create editor container
    const editorContainer = document.createElement('div');
    editorContainer.className = 'note-editor';
    editorContainer.style.cssText = `
        margin-left: 24px;
        margin-top: 4px;
        display: flex;
        gap: 8px;
        align-items: center;
        background: white;
        padding: 8px;
        border: 2px solid #007AFF;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    
    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.placeholder = 'Add a note...';
    input.style.cssText = `
        flex: 1;
        border: none;
        outline: none;
        font-size: 14px;
        font-style: italic;
        background: transparent;
        color: #333;
    `;
    
    // Create save button
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '✓';
    saveBtn.style.cssText = `
        background: #007AFF;
        color: white;
        border: none;
        border-radius: 4px;
        width: 28px;
        height: 28px;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // Create cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '✕';
    cancelBtn.style.cssText = `
        background: #666;
        color: white;
        border: none;
        border-radius: 4px;
        width: 28px;
        height: 28px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // Add delete button if note exists
    let deleteBtn = null;
    if (currentText) {
        deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑';
        deleteBtn.style.cssText = `
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 4px;
            width: 28px;
            height: 28px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
    }
    
    // Assemble editor
    editorContainer.appendChild(input);
    editorContainer.appendChild(saveBtn);
    editorContainer.appendChild(cancelBtn);
    if (deleteBtn) editorContainer.appendChild(deleteBtn);
    
    // Insert editor after note element
    noteElement.parentNode.insertBefore(editorContainer, noteElement.nextSibling);
    
    // Focus input and select text
    input.focus();
    input.select();
    
    // Event handlers
    const saveNote = () => {
        const newText = input.value.trim();
        if (newText) {
            updateNoteInMarkdown(lineNumber, newText);
        } else if (currentText) {
            removeNote(lineNumber);
        }
        cleanupEditor();
    };
    
    const cancelEdit = () => {
        cleanupEditor();
    };
    
    const deleteNote = () => {
        removeNote(lineNumber);
        cleanupEditor();
    };
    
    const cleanupEditor = () => {
        editorContainer.remove();
        noteElement.style.display = currentText ? 'block' : 'none';
    };
    
    // Button events
    saveBtn.addEventListener('click', saveNote);
    cancelBtn.addEventListener('click', cancelEdit);
    if (deleteBtn) deleteBtn.addEventListener('click', deleteNote);
    
    // Keyboard events
    input.addEventListener('keydown', (e) => {
        e.stopPropagation(); // Prevent triggering item actions
        if (e.key === 'Enter') {
            saveNote();
        } else if (e.key === 'Escape') {
            cancelEdit();
        }
    });
    
    // Click outside to cancel
    setTimeout(() => {
        const handleClickOutside = (e) => {
            if (!editorContainer.contains(e.target)) {
                cleanupEditor();
                document.removeEventListener('click', handleClickOutside);
            }
        };
        document.addEventListener('click', handleClickOutside);
    }, 100);
}

function updateNoteInMarkdown(lineNumber, noteText) {
    // Edit the markdown directly to update/add the note
    updateMarkdownLine(parseInt(lineNumber), (line) => {
        // Remove existing note if present
        line = line.replace(/\s*\[NOTE:\s*[^\]]+\]\s*$/, '');
        // Add new note
        return line + ` [NOTE: ${noteText}]`;
    });
    
    // Refresh the display and save
    refreshMarkdownDisplay();
    saveTrainingDayChanges();
}

function removeNote(lineNumber) {
    // Edit the markdown directly to remove the note
    updateMarkdownLine(parseInt(lineNumber), (line) => {
        // Remove note if present
        return line.replace(/\s*\[NOTE:\s*[^\]]+\]\s*$/, '');
    });
    
    // Refresh the display and save
    refreshMarkdownDisplay();
    saveTrainingDayChanges();
}

// Quick add note function (for the + Add note button) - now unused
function addNoteToItem(button) {
    const trainingItem = button.closest('.training-item');
    const noteElement = trainingItem.querySelector('.item-note');
    const lineNumber = trainingItem.getAttribute('data-line');
    
    // Check if already editing
    if (noteElement.querySelector('.note-editor')) return;
    
    // Create inline editing UI for new note
    createNoteEditor(noteElement, lineNumber, '');
}

// Simplified menu action functions
function markDone(button) {
    const menu = button.closest('.item-action-menu');
    const lineNumber = menu.dataset.trainingItem;
    const trainingItem = document.querySelector(`[data-line="${lineNumber}"]`);
    const checkbox = trainingItem.querySelector('.item-checkbox');
    const itemText = trainingItem.querySelector('.item-text');
    
    // Mark done action
    
    // Edit the markdown directly
    updateMarkdownLine(parseInt(lineNumber), (line) => {
        // Remove strikethrough if present
        line = line.replace(/~~(.*?)~~/g, '$1');
        
        if (line.match(/^(\s*)- \[ \] /)) {
            // Change unchecked to checked
            return line.replace(/^(\s*)- \[ \] /, '$1- [x] ');
        } else if (line.match(/^(\s*)- (?!\[)/)) {
            // Convert regular item to checked checkbox
            return line.replace(/^(\s*)- /, '$1- [x] ');
        }
        return line;
    });
    
    // Refresh the display and save
    refreshMarkdownDisplay();
    saveTrainingDayChanges();
    
    // Action completed
    
    menu.remove();
}

function skipItem(button) {
    const menu = button.closest('.item-action-menu');
    const lineNumber = menu.dataset.trainingItem;
    const trainingItem = document.querySelector(`[data-line="${lineNumber}"]`);
    const itemText = trainingItem.querySelector('.item-text');
    
    // Skip item action
    
    // Edit the markdown directly
    updateMarkdownLine(parseInt(lineNumber), (line) => {
        // Uncheck any checkboxes and add strikethrough
        if (line.match(/^(\s*)- \[x\] /)) {
            // Change checked to unchecked and add strikethrough
            return line.replace(/^(\s*)- \[x\] (.*)/, '$1- [ ] ~~$2~~');
        } else if (line.match(/^(\s*)- \[ \] /)) {
            // Add strikethrough to unchecked
            return line.replace(/^(\s*)- \[ \] (.*)/, '$1- [ ] ~~$2~~');
        } else if (line.match(/^(\s*)- (?!\[)/)) {
            // Add strikethrough to regular item
            return line.replace(/^(\s*)- (.*)/, '$1- ~~$2~~');
        } else if (line.match(/^# /)) {
            // Add strikethrough to heading 1
            return line.replace(/^# (.*)/, '# ~~$1~~');
        } else if (line.match(/^## /)) {
            // Add strikethrough to heading 2
            return line.replace(/^## (.*)/, '## ~~$1~~');
        } else if (line.match(/^### /)) {
            // Add strikethrough to heading 3
            return line.replace(/^### (.*)/, '### ~~$1~~');
        } else {
            // Add strikethrough to regular paragraph
            return `~~${line}~~`;
        }
    });
    
    // Refresh the display and save
    refreshMarkdownDisplay();
    saveTrainingDayChanges();
    
    // Action completed
    
    menu.remove();
}

function unskipItem(button) {
    const menu = button.closest('.item-action-menu');
    const lineNumber = menu.dataset.trainingItem;
    const trainingItem = document.querySelector(`[data-line="${lineNumber}"]`);
    const itemText = trainingItem.querySelector('.item-text');
    
    // Unskip item action
    
    // Edit the markdown directly to remove strikethrough
    updateMarkdownLine(parseInt(lineNumber), (line) => {
        // Remove strikethrough markers
        return line.replace(/~~(.*?)~~/g, '$1');
    });
    
    // Refresh the display and save
    refreshMarkdownDisplay();
    saveTrainingDayChanges();
    
    // Action completed
    
    menu.remove();
}

function undoItem(button) {
    const menu = button.closest('.item-action-menu');
    const lineNumber = menu.dataset.trainingItem;
    const trainingItem = document.querySelector(`[data-line="${lineNumber}"]`);
    const checkbox = trainingItem.querySelector('.item-checkbox');
    const itemText = trainingItem.querySelector('.item-text');
    
    // Undo item action
    
    // Edit the markdown directly to undo the action
    updateMarkdownLine(parseInt(lineNumber), (line) => {
        if (line.match(/^(\s*)- \[x\] /)) {
            // Change checked to unchecked
            return line.replace(/^(\s*)- \[x\] /, '$1- [ ] ');
        } else if (checkbox) {
            // If there was already a checkbox, just uncheck it
            return line.replace(/^(\s*)- \[x\] /, '$1- [ ] ');
        } else {
            // Convert back from checkbox to regular item
            return line.replace(/^(\s*)- \[x\] (.*)/, '$1- $2');
        }
    });
    
    // Refresh the display and save
    refreshMarkdownDisplay();
    saveTrainingDayChanges();
    
    // Action completed
    
    menu.remove();
}

function addNote(button) {
    const menu = button.closest('.item-action-menu');
    const lineNumber = menu.dataset.trainingItem;
    const trainingItem = document.querySelector(`[data-line="${lineNumber}"]`);
    const noteElement = trainingItem.querySelector('.item-note');
    
    // Add note action
    menu.remove();
    
    // Check if already editing
    if (noteElement.querySelector('.note-editor')) return;
    
    // Create inline editing UI for new note
    createNoteEditor(noteElement, lineNumber, '');
}

// Removed complex +item functionality for simplicity

// Old functions removed - using simplified 4-option menu now

function showAddItemForm() {
    const form = document.querySelector('.add-item-form');
    const button = document.querySelector('.add-item-btn');
    const input = document.querySelector('.add-item-input');
    
    form.style.display = 'block';
    button.style.display = 'none';
    input.focus();
}

function hideAddItemForm() {
    const form = document.querySelector('.add-item-form');
    const button = document.querySelector('.add-item-btn');
    const input = document.querySelector('.add-item-input');
    
    form.style.display = 'none';
    button.style.display = 'block';
    input.value = '';
}

function handleAddItemKeypress(event) {
    if (event.key === 'Enter') {
        addNewItem();
    } else if (event.key === 'Escape') {
        hideAddItemForm();
    }
}

function addNewItem() {
    const input = document.querySelector('.add-item-input');
    const text = input.value.trim();
    
    if (!text) return;
    
    const addItemSection = document.querySelector('.add-item-section');
    const newItem = document.createElement('div');
    newItem.className = 'training-item';
    newItem.dataset.line = Date.now(); // Use timestamp as unique identifier
    newItem.dataset.type = 'item';
    
    newItem.innerHTML = `
        <span class="item-bullet">•</span>
        <span class="item-text" onclick="showItemActions(this)">${text}</span>
        <span class="item-note" style="display: none;"></span>
    `;
    
    addItemSection.parentNode.insertBefore(newItem, addItemSection);
    
    hideAddItemForm();
    saveTrainingDayChanges();
}

// Store the original markdown content for direct editing
let originalMarkdownContent = '';

// Helper functions for direct markdown editing
function updateMarkdownLine(lineNumber, transformFunction) {
    const lines = originalMarkdownContent.split('\n');
    if (lineNumber > 0 && lineNumber <= lines.length) {
        lines[lineNumber - 1] = transformFunction(lines[lineNumber - 1]);
        originalMarkdownContent = lines.join('\n');
    }
}

function refreshMarkdownDisplay() {
    const contentDiv = document.getElementById('fileContent');
    contentDiv.innerHTML = formatMarkdown(originalMarkdownContent);
}

async function saveTrainingDayChanges() {
    if (!currentFileId) return;
    
    try {
        // Use the directly edited markdown content instead of DOM extraction
        const updatedContent = originalMarkdownContent;
        
        // File saved
        
        // Save to backend
        await apiCall(`${API_BASE}/coach/files/${document.getElementById('fileTitle').textContent}`, {
            method: 'PUT',
            body: JSON.stringify({
                content: updatedContent
            })
        });
        
        console.log('Training day changes saved');
    } catch (error) {
        console.error('Failed to save training day changes:', error);
    }
}

function extractMarkdownFromDOM(container) {
    let markdown = '';
    
    for (const element of container.children) {
        if (element.tagName === 'H1') {
            markdown += `# ${element.textContent}\n`;
        } else if (element.tagName === 'H2') {
            markdown += `## ${element.textContent}\n`;
        } else if (element.tagName === 'H3') {
            markdown += `### ${element.textContent}\n`;
        } else if (element.classList.contains('training-item')) {
            const itemText = element.querySelector('.item-text');
            const itemNote = element.querySelector('.item-note');
            const checkbox = element.querySelector('.item-checkbox');
            
            // Calculate indentation from marginLeft style - with safety caps
            const marginLeft = element.style.marginLeft || '0px';
            const marginPixels = parseInt(marginLeft.replace('px', '')) || 0;
            let indentLevel = Math.floor(marginPixels / 12); // 12px per indent level
            
            // Safety cap: never allow more than 4 levels of indentation
            indentLevel = Math.min(indentLevel, 4);
            
            const indentSpaces = '  '.repeat(indentLevel); // 2 spaces per indent level
            
            // Debug if we're seeing crazy values
            if (marginPixels > 48) {
                console.warn(`Excessive indentation detected: ${marginLeft} (${marginPixels}px) for element:`, element);
            }
            
            let line = indentSpaces;
            
            if (checkbox) {
                line += checkbox.checked ? '- [x] ' : '- [ ] ';
            } else {
                line += '- ';
            }
            
            // Convert HTML back to markdown
            let textContent = itemText.innerHTML;
            // Convert strikethrough
            textContent = textContent.replace(/<del>(.*?)<\/del>/g, '~~$1~~');
            // Convert other formatting back to markdown
            textContent = textContent.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
            textContent = textContent.replace(/<em>(.*?)<\/em>/g, '*$1*');
            textContent = textContent.replace(/<code>(.*?)<\/code>/g, '`$1`');
            // Remove any other HTML tags and get text content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = textContent;
            line += tempDiv.textContent || tempDiv.innerText;
            
            if (itemNote && itemNote.style.display !== 'none' && itemNote.textContent) {
                // Extract note text and format as [NOTE: ...]
                const noteText = itemNote.textContent.trim();
                line += ` [NOTE: ${noteText}]`;
            }
            
            markdown += line + '\n';
        } else if (element.classList.contains('add-item-section')) {
            // Skip the add item section
            continue;
        } else if (element.textContent && element.textContent.trim()) {
            // Handle other content - only add if it has actual content
            markdown += element.textContent.trim() + '\n';
        }
        // Skip <br> tags entirely - they're not needed in clean markdown
    }
    
    return markdown.trim();
}

// Debug functions for viewing raw markdown
function toggleRawView() {
    if (!currentFileData) return;
    
    const contentDiv = document.getElementById('fileContent');
    const rawBtn = document.getElementById('viewRawBtn');
    const fileName = document.getElementById('fileTitle').textContent;
    
    if (isRawView) {
        // Switch back to formatted view - reset all inline styles first
        contentDiv.style.whiteSpace = '';
        contentDiv.style.fontFamily = '';
        contentDiv.style.fontSize = '';
        contentDiv.style.backgroundColor = '';
        contentDiv.style.border = '';
        
        // Then reload the file to get fresh content
        const fileName = document.getElementById('fileTitle').textContent;
        loadFile(currentFileId, fileName);
        return; // loadFile will handle the rest
    } else {
        // Switch to raw view
        contentDiv.className = 'file-content';
        contentDiv.style.whiteSpace = 'pre-wrap';
        contentDiv.style.fontFamily = 'Monaco, Menlo, monospace';
        contentDiv.style.fontSize = '14px';
        contentDiv.style.backgroundColor = '#f8f9fa';
        contentDiv.style.border = '1px solid #dee2e6';
        contentDiv.textContent = typeof currentFileData.content === 'string' 
            ? currentFileData.content 
            : JSON.stringify(currentFileData.content, null, 2);
        rawBtn.textContent = '📋 Formatted';
        rawBtn.style.backgroundColor = '#28a745';
        isRawView = true;
    }
}

// Changelog functionality removed