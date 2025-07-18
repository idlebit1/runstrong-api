const API_BASE = `${window.location.protocol}//${window.location.host}/api`;
let authToken = localStorage.getItem('authToken');
let refreshToken = localStorage.getItem('refreshToken');
let currentUser = null;
let currentConversationId = null;
let currentFileId = null;
let currentView = 'chat'; // 'chat' or 'file'
let fileChangeLog = []; // Track all changes to the current file
let currentFileData = null; // Store current file data for debug views
let isRawView = false; // Track if showing raw markdown

// Function to log user actions
function logFileChange(action, details = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        action: action,
        details: details,
        user: currentUser?.email || 'unknown'
    };
    
    fileChangeLog.push(logEntry);
    console.log('File change logged:', logEntry);
}

// Function to get the change log (for AI agent access)
function getFileChangeLog() {
    return {
        fileName: document.getElementById('fileTitle')?.textContent || 'unknown',
        totalChanges: fileChangeLog.length,
        changes: fileChangeLog,
        summary: generateChangeLogSummary()
    };
}

// Function to generate a human-readable summary of changes
function generateChangeLogSummary() {
    const summary = {
        checkboxToggles: fileChangeLog.filter(log => log.action === 'checkbox_toggle').length,
        notesAdded: fileChangeLog.filter(log => log.action === 'note_added' || log.action === 'done_with_note').length,
        itemsSkipped: fileChangeLog.filter(log => log.action === 'skip_with_reason').length,
        itemsEdited: fileChangeLog.filter(log => log.action === 'edit_activity').length,
        markDoneActions: fileChangeLog.filter(log => log.action === 'mark_done').length,
        timeSpent: null
    };
    
    // Calculate time spent if we have file_opened
    const fileOpened = fileChangeLog.find(log => log.action === 'file_opened');
    const lastAction = fileChangeLog[fileChangeLog.length - 1];
    if (fileOpened && lastAction) {
        const startTime = new Date(fileOpened.timestamp);
        const endTime = new Date(lastAction.timestamp);
        summary.timeSpent = Math.round((endTime - startTime) / 1000); // seconds
    }
    
    return summary;
}

// Make change log available globally for AI agent
window.getFileChangeLog = getFileChangeLog;

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
            const isChangeLog = file.fileName.endsWith('.changelog');
            return `
            <div class="file-item ${file.id === currentFileId ? 'active' : ''} ${isChangeLog ? 'changelog-file' : ''}" 
                 data-file-id="${file.id}">
                <div class="file-name">${file.fileName} ${isChangeLog ? '📊' : ''}</div>
                <div class="file-meta">
                    ${file.fileType} • ${formatFileSize(file.size)} • ${new Date(file.updatedAt).toLocaleDateString()}
                    ${isChangeLog ? ' • Read-only' : ''}
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
        
        // Reset change log for new file
        fileChangeLog = [];
        
        // Log file opening
        logFileChange('file_opened', {
            fileName: fileName,
            fileSize: result.content ? result.content.length : 0,
            fileType: fileName.split('.').pop()
        });
        
        document.getElementById('fileTitle').textContent = fileName;
        document.getElementById('fileSubtitle').textContent = 
            `Last updated: ${new Date().toLocaleDateString()}`;
        
        const contentDiv = document.getElementById('fileContent');
        
        // Handle changelog files specially
        if (result.isChangeLog) {
            document.getElementById('fileSubtitle').textContent = 
                `Read-only change log • Last updated: ${new Date().toLocaleDateString()}`;
            contentDiv.className = 'file-content markdown';
            contentDiv.innerHTML = formatMarkdown(result.content);
            // Add visual indicator for read-only
            contentDiv.style.backgroundColor = '#f9f9f9';
            contentDiv.style.border = '2px solid #e9ecef';
        }
        // Determine content type and apply appropriate formatting
        else if (fileName.trim().endsWith('.md') || fileName.trim().endsWith('.markdown')) {
            console.log('Processing markdown file:', fileName);
            console.log('Raw content:', result.content);
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
        if (!fileName.endsWith('.changelog')) {
            document.getElementById('viewChangelogBtn').style.display = 'inline-block';
        } else {
            document.getElementById('viewChangelogBtn').style.display = 'none';
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
    const lines = content.split('\n');
    let html = '';
    let lineNumber = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        lineNumber++;
        
        // Handle headers
        if (line.match(/^# /)) {
            html += `<h1>${formatInlineMarkdown(line.replace(/^# /, ''))}</h1>`;
            continue;
        }
        if (line.match(/^## /)) {
            html += `<h2>${formatInlineMarkdown(line.replace(/^## /, ''))}</h2>`;
            continue;
        }
        if (line.match(/^### /)) {
            html += `<h3>${formatInlineMarkdown(line.replace(/^### /, ''))}</h3>`;
            continue;
        }
        
        // Handle any level of indented checkboxes (make them ALL interactive)
        if (line.match(/^(\s*)- \[(?:x| )\] /)) {
            const indent = line.match(/^(\s*)/)[1].length;
            const isChecked = line.match(/^(\s*)- \[x\] /) ? 'true' : 'false';
            const text = line.replace(/^(\s*)- \[(?:x| )\] /, '');
            const checked = isChecked === 'true';
            const checkedClass = checked ? 'checked' : 'unchecked';
            const checkedAttr = checked ? 'checked' : '';
            const marginLeft = indent * 12; // 12px per indent level
            
            html += `<div class="training-item ${checkedClass}" data-line="${lineNumber}" data-type="checkbox" style="margin-left: ${marginLeft}px;">
                <div class="item-row">
                    <input type="checkbox" class="item-checkbox" ${checkedAttr} onchange="toggleCheckbox(this)"> 
                    <span class="item-text" onclick="showItemActions(this)">${formatInlineMarkdown(text)}</span>
                </div>
                <div class="item-note" style="display: none; margin-left: 24px; margin-top: 4px; font-style: italic; color: #666; font-size: 14px;"></div>
                <div class="add-note-prompt" style="display: none; margin-left: 24px; margin-top: 8px;">
                    <button class="add-note-btn" onclick="addNoteToItem(this)">+ Add note</button>
                </div>
            </div>`;
            continue;
        }
        
        // Handle any level of indented regular list items (make them ALL interactive)  
        if (line.match(/^(\s*)- (?!\[)/)) {
            const indent = line.match(/^(\s*)/)[1].length;
            const text = line.replace(/^(\s*)- /, '');
            const marginLeft = indent * 12; // 12px per indent level
            
            html += `<div class="training-item" data-line="${lineNumber}" data-type="item" style="margin-left: ${marginLeft}px;">
                <div class="item-row">
                    <span class="item-bullet">•</span>
                    <span class="item-text" onclick="showItemActions(this)">${formatInlineMarkdown(text)}</span>
                </div>
                <div class="item-note" style="display: none; margin-left: 24px; margin-top: 4px; font-style: italic; color: #666; font-size: 14px;"></div>
                <div class="add-note-prompt" style="display: none; margin-left: 24px; margin-top: 8px;">
                    <button class="add-note-btn" onclick="addNoteToItem(this)">+ Add note</button>
                </div>
            </div>`;
            continue;
        }
        
        // Handle regular paragraphs
        const formatted = formatInlineMarkdown(line);
        if (formatted || line.trim() === '') {
            html += formatted || '<br>';
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
    
    // Log the checkbox toggle
    logFileChange('checkbox_toggle', {
        lineNumber: lineNumber,
        itemText: itemText.textContent,
        checked: isChecked,
        previousState: isChecked ? 'unchecked' : 'checked'
    });
    
    // Hide all existing add-note prompts
    document.querySelectorAll('.add-note-prompt').forEach(prompt => {
        prompt.style.display = 'none';
    });
    
    if (isChecked) {
        trainingItem.classList.remove('unchecked');
        trainingItem.classList.add('checked');
        
        // Show add-note prompt for the most recently checked item
        const notePrompt = trainingItem.querySelector('.add-note-prompt');
        if (notePrompt) {
            notePrompt.style.display = 'block';
        }
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
    
    actionMenu.innerHTML = `
        <div style="padding: 8px 16px; font-weight: 500; color: #666; border-bottom: 1px solid #eee; margin-bottom: 4px;">What would you like to do?</div>
        <button onclick="markDone(this)" style="display: block; width: 100%; padding: 12px 16px; border: none; background: none; text-align: left; cursor: pointer; font-size: 14px; color: #333;">✓ Mark Done</button>
        <button onclick="doneWithNote(this)" style="display: block; width: 100%; padding: 12px 16px; border: none; background: none; text-align: left; cursor: pointer; font-size: 14px; color: #333;">📝 Done with Note</button>
        <button onclick="skipWithReason(this)" style="display: block; width: 100%; padding: 12px 16px; border: none; background: none; text-align: left; cursor: pointer; font-size: 14px; color: #333;">⚠️ Skip with Reason</button>
        <button onclick="editActivity(this)" style="display: block; width: 100%; padding: 12px 16px; border: none; background: none; text-align: left; cursor: pointer; font-size: 14px; color: #333;">✏️ Edit Activity</button>
    `;
    
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

// Quick add note function (for the + Add note button)
function addNoteToItem(button) {
    const trainingItem = button.closest('.training-item');
    const noteSpan = trainingItem.querySelector('.item-note');
    const notePrompt = trainingItem.querySelector('.add-note-prompt');
    const itemText = trainingItem.querySelector('.item-text');
    const lineNumber = trainingItem.getAttribute('data-line');
    
    const newNote = prompt('Add a quick note:');
    
    if (newNote !== null && newNote.trim()) {
        // Log the note addition
        logFileChange('note_added', {
            lineNumber: lineNumber,
            itemText: itemText.textContent,
            noteText: newNote,
            method: 'quick_add_button'
        });
        
        noteSpan.textContent = newNote;
        noteSpan.style.display = 'block';
        
        // Hide the add note prompt
        notePrompt.style.display = 'none';
        
        saveTrainingDayChanges();
    }
}

// Menu action functions
function markDone(button) {
    const menu = button.closest('.item-action-menu');
    const lineNumber = menu.dataset.trainingItem;
    const trainingItem = document.querySelector(`[data-line="${lineNumber}"]`);
    const checkbox = trainingItem.querySelector('.item-checkbox');
    const itemText = trainingItem.querySelector('.item-text');
    const wasSkipped = trainingItem.classList.contains('skipped');
    
    // Log the mark done action
    logFileChange('mark_done', {
        lineNumber: lineNumber,
        itemText: itemText.textContent,
        method: 'menu_action',
        wasSkipped: wasSkipped,
        wasChecked: checkbox ? checkbox.checked : false
    });
    
    // Remove skipped styling if present
    if (itemText) {
        // Remove strikethrough HTML tags
        itemText.innerHTML = itemText.innerHTML.replace(/<del>(.*?)<\/del>/g, '$1');
        itemText.style.textDecoration = 'none';
        itemText.style.opacity = '';
    }
    trainingItem.classList.remove('skipped');
    
    if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        toggleCheckbox(checkbox);
    }
    
    menu.remove();
}

function doneWithNote(button) {
    const menu = button.closest('.item-action-menu');
    const lineNumber = menu.dataset.trainingItem;
    const trainingItem = document.querySelector(`[data-line="${lineNumber}"]`);
    const checkbox = trainingItem.querySelector('.item-checkbox');
    const noteSpan = trainingItem.querySelector('.item-note');
    const itemText = trainingItem.querySelector('.item-text');
    const wasSkipped = trainingItem.classList.contains('skipped');
    
    const newNote = prompt('Done! Add a note:');
    
    if (newNote !== null) {
        // Log the done with note action
        logFileChange('done_with_note', {
            lineNumber: lineNumber,
            itemText: itemText.textContent,
            noteText: newNote.trim(),
            method: 'menu_action',
            wasSkipped: wasSkipped,
            wasChecked: checkbox ? checkbox.checked : false
        });
        
        // Remove skipped styling if present
        if (itemText) {
            // Remove strikethrough HTML tags
            itemText.innerHTML = itemText.innerHTML.replace(/<del>(.*?)<\/del>/g, '$1');
            itemText.style.textDecoration = 'none';
            itemText.style.opacity = '';
        }
        trainingItem.classList.remove('skipped');
        
        // Mark as done
        if (checkbox && !checkbox.checked) {
            checkbox.checked = true;
            trainingItem.classList.remove('unchecked');
            trainingItem.classList.add('checked');
        }
        
        // Add note if provided
        if (newNote.trim()) {
            noteSpan.textContent = newNote;
            noteSpan.style.display = 'block';
        }
        
        saveTrainingDayChanges();
    }
    
    menu.remove();
}

function skipWithReason(button) {
    const menu = button.closest('.item-action-menu');
    const lineNumber = menu.dataset.trainingItem;
    const trainingItem = document.querySelector(`[data-line="${lineNumber}"]`);
    const checkbox = trainingItem.querySelector('.item-checkbox');
    const noteSpan = trainingItem.querySelector('.item-note');
    const itemText = trainingItem.querySelector('.item-text');
    
    const reason = prompt('Why are you skipping this?');
    
    if (reason !== null) {
        // Log the skip action
        logFileChange('skip_with_reason', {
            lineNumber: lineNumber,
            itemText: itemText.textContent,
            reason: reason.trim(),
            method: 'menu_action',
            wasChecked: checkbox ? checkbox.checked : false
        });
        
        // Ensure checkbox is unchecked
        if (checkbox) {
            checkbox.checked = false;
            trainingItem.classList.remove('checked');
            trainingItem.classList.add('unchecked');
        }
        
        // Add strikethrough markdown to the item text
        if (itemText) {
            const currentText = itemText.innerHTML;
            // Only add strikethrough if not already present
            if (!currentText.includes('<del>')) {
                // Wrap the current content in strikethrough
                itemText.innerHTML = `<del>${currentText}</del>`;
            }
        }
        
        // Add skip reason if provided (formatted like a regular note)
        if (reason.trim()) {
            noteSpan.textContent = reason;
            noteSpan.style.display = 'block';
            noteSpan.style.color = '#666'; // Same color as regular notes
        }
        
        // Mark the item as skipped for easy identification
        trainingItem.classList.add('skipped');
        
        saveTrainingDayChanges();
    }
    
    menu.remove();
}

function editActivity(button) {
    const menu = button.closest('.item-action-menu');
    const lineNumber = menu.dataset.trainingItem;
    const trainingItem = document.querySelector(`[data-line="${lineNumber}"]`);
    const itemText = trainingItem.querySelector('.item-text');
    
    const currentText = itemText.textContent;
    const newText = prompt('Edit activity:', currentText);
    
    if (newText !== null && newText.trim() && newText !== currentText) {
        // Log the edit action
        logFileChange('edit_activity', {
            lineNumber: lineNumber,
            originalText: currentText,
            newText: newText,
            method: 'menu_action'
        });
        
        itemText.textContent = newText;
        
        // Add a small edited indicator
        let editedIndicator = trainingItem.querySelector('.edited-indicator');
        if (!editedIndicator) {
            editedIndicator = document.createElement('span');
            editedIndicator.className = 'edited-indicator';
            editedIndicator.textContent = ' (edited)';
            editedIndicator.style.fontSize = '12px';
            editedIndicator.style.color = '#999';
            editedIndicator.style.fontStyle = 'italic';
            itemText.appendChild(editedIndicator);
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
        
        // Log the save action
        logFileChange('file_saved', {
            fileName: document.getElementById('fileTitle').textContent,
            contentLength: updatedContent.length,
            totalChanges: fileChangeLog.length - 1 // Subtract 1 for the file_opened entry
        });
        
        // Save to backend with change log
        await apiCall(`${API_BASE}/coach/files/${document.getElementById('fileTitle').textContent}`, {
            method: 'PUT',
            body: JSON.stringify({
                content: updatedContent,
                changeLog: fileChangeLog // Include the change log
            })
        });
        
        console.log('Training day changes saved with change log:', fileChangeLog);
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

// Debug functions for viewing raw markdown and changelog
function toggleRawView() {
    if (!currentFileData) return;
    
    const contentDiv = document.getElementById('fileContent');
    const rawBtn = document.getElementById('viewRawBtn');
    const fileName = document.getElementById('fileTitle').textContent;
    
    if (isRawView) {
        // Switch back to formatted view
        if (fileName.trim().endsWith('.md') || fileName.trim().endsWith('.markdown')) {
            contentDiv.className = 'file-content markdown';
            contentDiv.innerHTML = formatMarkdown(currentFileData.content);
            contentDiv.style.backgroundColor = '';
            contentDiv.style.border = '';
        } else if (fileName.endsWith('.json')) {
            contentDiv.className = 'file-content';
            contentDiv.textContent = JSON.stringify(currentFileData.content, null, 2);
        } else {
            contentDiv.className = 'file-content';
            contentDiv.textContent = currentFileData.content;
        }
        rawBtn.textContent = '📄 Raw';
        rawBtn.style.backgroundColor = '#6c757d';
        isRawView = false;
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

async function viewChangelog() {
    if (!currentFileData) return;
    
    const fileName = document.getElementById('fileTitle').textContent;
    const changelogFileName = `${fileName}.changelog`;
    
    try {
        // Try to load the changelog file
        const result = await apiCall(`${API_BASE}/coach/files/${changelogFileName}`);
        
        // Store current state
        const originalFileData = currentFileData;
        const originalFileName = fileName;
        
        // Load changelog as if it's a regular file
        currentFileData = result;
        isRawView = false;
        
        document.getElementById('fileTitle').textContent = changelogFileName;
        document.getElementById('fileSubtitle').textContent = 
            `Change log for ${originalFileName} • Read-only`;
        
        const contentDiv = document.getElementById('fileContent');
        contentDiv.className = 'file-content markdown';
        contentDiv.innerHTML = formatMarkdown(result.content);
        contentDiv.style.backgroundColor = '#f9f9fa';
        contentDiv.style.border = '2px solid #e9ecef';
        
        // Update button text to show we can go back
        const changelogBtn = document.getElementById('viewChangelogBtn');
        changelogBtn.textContent = '← Back to File';
        changelogBtn.onclick = () => {
            // Restore original file
            currentFileData = originalFileData;
            loadFile(currentFileId, originalFileName);
        };
        
    } catch (error) {
        if (error.message.includes('File not found')) {
            showError(`No changelog found for ${fileName}. Changes will be logged when you interact with the file.`);
        } else {
            showError('Failed to load changelog: ' + error.message);
        }
    }
}