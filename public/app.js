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
        let errorMessage = error.message;
        
        // Provide more helpful error messages
        if (error.message.includes('Invalid email or password')) {
            errorMessage = 'Invalid email or password. Don\'t have an account? Click "Register" to create one.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = 'Connection error. Please check your internet connection and try again.';
        } else if (error.message.includes('server')) {
            errorMessage = 'Server error. Please try again in a moment.';
        }
        
        showError('login-error', errorMessage);
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
    // Track line numbers for interactive features
    let lineNumber = 0;
    
    // Basic markdown formatting for display with interactive elements
    return content
        .split('\n')
        .map(line => {
            lineNumber++;
            
            // Handle checkboxes (make them interactive)
            if (line.match(/^- \[ \] /)) {
                const text = line.replace(/^- \[ \] /, '');
                return `<div class="training-item unchecked" data-line="${lineNumber}" data-type="checkbox">
                    <input type="checkbox" class="item-checkbox" onchange="toggleCheckbox(this)"> 
                    <span class="item-text" onclick="showItemActions(this)">${text}</span>
                    <span class="item-note" style="display: none;"></span>
                </div>`;
            }
            
            if (line.match(/^- \[x\] /)) {
                const text = line.replace(/^- \[x\] /, '');
                return `<div class="training-item checked" data-line="${lineNumber}" data-type="checkbox">
                    <input type="checkbox" class="item-checkbox" checked onchange="toggleCheckbox(this)"> 
                    <span class="item-text" onclick="showItemActions(this)">${text}</span>
                    <span class="item-note" style="display: none;"></span>
                </div>`;
            }
            
            // Handle regular list items (make them interactive)
            if (line.match(/^- /)) {
                const text = line.replace(/^- /, '');
                return `<div class="training-item" data-line="${lineNumber}" data-type="item">
                    <span class="item-bullet">•</span>
                    <span class="item-text" onclick="showItemActions(this)">${text}</span>
                    <span class="item-note" style="display: none;"></span>
                </div>`;
            }
            
            // Handle headers
            if (line.match(/^# /)) return `<h1>${line.replace(/^# /, '')}</h1>`;
            if (line.match(/^## /)) return `<h2>${line.replace(/^## /, '')}</h2>`;
            if (line.match(/^### /)) return `<h3>${line.replace(/^### /, '')}</h3>`;
            
            // Handle other markdown
            let formatted = line
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`(.*?)`/g, '<code>$1</code>');
            
            return formatted || '<br>';
        })
        .join('')
        + `<div class="add-item-section">
            <button class="add-item-btn" onclick="showAddItemForm()">+ Add Item</button>
            <div class="add-item-form" style="display: none;">
                <input type="text" class="add-item-input" placeholder="Enter new item..." onkeypress="handleAddItemKeypress(event)">
                <button onclick="addNewItem()">Add</button>
                <button onclick="hideAddItemForm()">Cancel</button>
            </div>
        </div>`;
}

// Training day interactive functions
function toggleCheckbox(checkbox) {
    const trainingItem = checkbox.closest('.training-item');
    const isChecked = checkbox.checked;
    
    if (isChecked) {
        trainingItem.classList.remove('unchecked');
        trainingItem.classList.add('checked');
    } else {
        trainingItem.classList.remove('checked');
        trainingItem.classList.add('unchecked');
    }
    
    // Save the change to the file
    saveTrainingDayChanges();
}

function showItemActions(itemText) {
    // Remove any existing action menus
    document.querySelectorAll('.item-action-menu').forEach(menu => menu.remove());
    
    const trainingItem = itemText.closest('.training-item');
    const rect = itemText.getBoundingClientRect();
    
    const actionMenu = document.createElement('div');
    actionMenu.className = 'item-action-menu';
    actionMenu.style.position = 'fixed';
    actionMenu.style.top = (rect.bottom + 5) + 'px';
    actionMenu.style.left = rect.left + 'px';
    actionMenu.style.zIndex = '1000';
    actionMenu.style.backgroundColor = 'white';
    actionMenu.style.border = '1px solid #ccc';
    actionMenu.style.borderRadius = '4px';
    actionMenu.style.padding = '8px';
    actionMenu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    
    actionMenu.innerHTML = `
        <button onclick="addNote(this)" style="display: block; width: 100%; margin-bottom: 4px; padding: 4px 8px; border: none; background: none; text-align: left; cursor: pointer;">📝 Add Note</button>
        <button onclick="toggleStrikethrough(this)" style="display: block; width: 100%; margin-bottom: 4px; padding: 4px 8px; border: none; background: none; text-align: left; cursor: pointer;">✂️ Strikethrough</button>
        <button onclick="removeItem(this)" style="display: block; width: 100%; padding: 4px 8px; border: none; background: none; text-align: left; cursor: pointer; color: #d32f2f;">🗑️ Remove</button>
    `;
    
    // Store reference to the training item
    actionMenu.dataset.trainingItem = trainingItem.dataset.line;
    
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

function addNote(button) {
    const menu = button.closest('.item-action-menu');
    const lineNumber = menu.dataset.trainingItem;
    const trainingItem = document.querySelector(`[data-line="${lineNumber}"]`);
    const noteSpan = trainingItem.querySelector('.item-note');
    
    const existingNote = noteSpan.textContent;
    const newNote = prompt('Add a note:', existingNote);
    
    if (newNote !== null) {
        if (newNote.trim()) {
            noteSpan.textContent = ` (${newNote})`;
            noteSpan.style.display = 'inline';
            noteSpan.style.fontStyle = 'italic';
            noteSpan.style.color = '#666';
        } else {
            noteSpan.textContent = '';
            noteSpan.style.display = 'none';
        }
        saveTrainingDayChanges();
    }
    
    menu.remove();
}

function toggleStrikethrough(button) {
    const menu = button.closest('.item-action-menu');
    const lineNumber = menu.dataset.trainingItem;
    const trainingItem = document.querySelector(`[data-line="${lineNumber}"]`);
    const itemText = trainingItem.querySelector('.item-text');
    
    if (itemText.style.textDecoration === 'line-through') {
        itemText.style.textDecoration = 'none';
        itemText.style.opacity = '1';
    } else {
        itemText.style.textDecoration = 'line-through';
        itemText.style.opacity = '0.6';
    }
    
    saveTrainingDayChanges();
    menu.remove();
}

function removeItem(button) {
    const menu = button.closest('.item-action-menu');
    const lineNumber = menu.dataset.trainingItem;
    const trainingItem = document.querySelector(`[data-line="${lineNumber}"]`);
    
    if (confirm('Remove this item?')) {
        trainingItem.remove();
        saveTrainingDayChanges();
    }
    
    menu.remove();
}

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

async function saveTrainingDayChanges() {
    if (!currentFileId) return;
    
    try {
        // Extract current content from the DOM
        const fileContent = document.getElementById('fileContent');
        const updatedContent = extractMarkdownFromDOM(fileContent);
        
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
            
            let line = '';
            
            if (checkbox) {
                line = checkbox.checked ? '- [x] ' : '- [ ] ';
            } else {
                line = '- ';
            }
            
            line += itemText.textContent;
            
            if (itemNote && itemNote.style.display !== 'none' && itemNote.textContent) {
                // Extract note text (remove parentheses)
                const noteText = itemNote.textContent.replace(/^\s*\(|\)\s*$/g, '');
                line += ` (${noteText})`;
            }
            
            markdown += line + '\n';
        } else if (element.classList.contains('add-item-section')) {
            // Skip the add item section
            continue;
        } else if (element.tagName === 'BR') {
            markdown += '\n';
        } else {
            // Handle other content
            markdown += element.textContent + '\n';
        }
    }
    
    return markdown.trim();
}