const API_BASE = `${window.location.protocol}//${window.location.host}/api/coach`;
const API_KEY = 'test-key-123';
let currentConversationId = null;
let currentFileId = null;
let currentView = 'chat'; // 'chat' or 'file'

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded fired');
    
    // Check if elements exist
    const newConversationBtn = document.getElementById('newConversationBtn');
    console.log('newConversationBtn found:', !!newConversationBtn);
    
    if (newConversationBtn) {
        newConversationBtn.addEventListener('click', function() {
            console.log('Button clicked!');
            createNewConversation();
        });
    }
    
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
    
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
    
    refreshConversations();
});

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function apiCall(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `ApiKey ${API_KEY}`,
            ...options.headers
        },
        ...options
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API call failed');
    }
    
    return response.json();
}

async function createNewConversation() {
    console.log('createNewConversation called');
    try {
        const userId = document.getElementById('userId').value;
        console.log('User ID:', userId);
        console.log('API_BASE:', API_BASE);
        
        const result = await apiCall(`${API_BASE}/conversations`, {
            method: 'POST',
            body: JSON.stringify({
                title: 'New Training Session',
                userId: userId
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
        const userId = document.getElementById('userId').value;
        const result = await apiCall(`${API_BASE}/conversations?userId=${userId}`);
        
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
        const userId = document.getElementById('userId').value;
        const result = await apiCall(`${API_BASE}/conversations/${conversationId}?userId=${userId}`);
        
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
        const userId = document.getElementById('userId').value;
        const result = await apiCall(`${API_BASE}/conversations/${currentConversationId}/messages`, {
            method: 'POST',
            body: JSON.stringify({
                message: message,
                userId: userId
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
        const userId = document.getElementById('userId').value;
        const result = await apiCall(`${API_BASE}/files?userId=${userId}`);
        
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
        const userId = document.getElementById('userId').value;
        const result = await apiCall(`${API_BASE}/files/${fileName}?userId=${userId}`);
        
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