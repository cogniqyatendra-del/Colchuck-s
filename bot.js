/**
 * Colchuck's Chatbot Logic
 * Connects to Cloudflare Worker for Gemini AI responses
 */

const CHATBOT_CONFIG = {
    workerUrl: "https://withered-base-1bc3.cogniq-yatendra.workers.dev/",
    projectId: "COLCHUCKS",
    model: "gemma-3-4b-it",
    systemInstruction: `You are the "Colchuck's Concierge", a friendly, knowledgeable, and professional representative for Colchuck's restaurant in Leavenworth, Washington.

CRITICAL: Keep answers VERY brief, direct, and accurate. Maximum 2-3 sentences. No fluff.

About Colchuck's:
- Owners: Carl and Gavin Evans (Father & Son duo).
- Mission: Providing modern German comfort food with a Pacific Northwest twist.
- Location: 801 Front St, Leavenworth, WA 98826. (Note: We are located upstairs, above Stein).
- Vibe: Warm, cozy, mountain charm, cinematic atmosphere.

Operating Hours:
- Monday, Thursday: 3:00 PM - 8:30 PM
- Tuesday & Wednesday: CLOSED
- Friday, Saturday: 12:00 PM - 9:00 PM
- Sunday: 12:00 PM - 8:30 PM
- Holiday Hours: 12:00 PM - 8:30 PM (Closed Christmas Eve & Christmas Day).

Special Offers:
- Happy Hour: Daily 3:00 PM - 4:30 PM ($5 off cocktails/shareables/wine, half-price pitchers).
- Kids Eat Free: Daily 12:00 PM - 3:00 PM (Ages 12 & under) with adult meal.

Menu Highlights:
- Shareables: Deviled Eggs, Fried Brie, Pretzel Bites, Crispy Brussels.
- Mains: Wiener Schnitzel, Jagerschnitzel, Kobe Burgers, Brat Burger.
- Desserts: Apple Strudel, Sticky Toffee Pudding.

Policies:
- Reservations: Recommended. Groups >10 call (509) 548-5074.
- Accessibility: No wheelchair access (stairs only).
- Takeout: Available! Call to order. No delivery.`,
    suggestions: [
        "Location",
        "Happy Hour",
        "Reservations",
        "Menu"
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    const launcher = document.getElementById('chatbot-launcher');
    const window = document.getElementById('chatbot-window');
    const closeBtn = document.getElementById('close-chatbot');
    const inputField = document.getElementById('chatbot-input-field');
    const sendBtn = document.getElementById('send-chatbot-msg');
    const clearBtn = document.getElementById('clear-chatbot');
    const messagesContainer = document.getElementById('chatbot-messages');
    const suggestionsContainer = document.getElementById('chatbot-suggestions');

    let isTyping = false;
    let lastUserMessageWasLocationQuery = false;

    // Time-based greeting helpers
    function getTimeGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }

    function formatWelcome() {
        return `${getTimeGreeting()}! I'm your Colchuck's Concierge. How can I help you today?`;
    }

    // Render Suggestions
    const renderSuggestions = () => {
        if (!suggestionsContainer) return;
        suggestionsContainer.innerHTML = '';
        CHATBOT_CONFIG.suggestions.forEach(suggestion => {
            const btn = document.createElement('button');
            btn.className = 'suggestion-btn';
            btn.innerText = suggestion;
            btn.addEventListener('click', () => {
                inputField.value = suggestion;
                // Specifically trigger location logic if this suggestion is clicked
                if (suggestion === 'Location') {
                    lastUserMessageWasLocationQuery = true;
                }
                handleSendMessage();
            });
            suggestionsContainer.appendChild(btn);
        });
    };

    renderSuggestions();

    // Toggle Chat Window
    launcher.addEventListener('click', () => {
        window.classList.toggle('hidden');
        if (!window.classList.contains('hidden')) {
            inputField.focus();
            // Refresh welcome message when opening
            showInitialWelcome();
        }
        // Hide the launcher while the chat window is open (prevents overlap on small screens)
        const isOpen = !window.classList.contains('hidden');
        try {
            launcher.style.display = isOpen ? 'none' : 'flex';
        } catch (e) {}

        // Notify scroll listener to update backToTop visibility
        window.dispatchEvent(new Event('scroll'));
    });

    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.classList.add('hidden');
        // restore launcher visibility when chat closed
        try { launcher.style.display = 'flex'; } catch (e) {}
        // Notify scroll listener to update backToTop visibility
        window.dispatchEvent(new Event('scroll'));
    });

    // Clear Chat Handler
    clearBtn.addEventListener('click', () => {
        // Reset chat to initial greeting
        showInitialWelcome();

        // Show suggestions again
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'grid';
        }

        // Reset flags
        lastUserMessageWasLocationQuery = false;
    });

    // Show initial welcome message (uses time-based greeting)
    function showInitialWelcome() {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = '';
        appendMessage('bot', formatWelcome());
    }

    // Handle Sending Message
    const handleSendMessage = async () => {
        const message = inputField.value.trim();
        if (!message || isTyping) return;

        // Hide suggestions after first interaction
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
        }

        // Check if this is a location query
        lastUserMessageWasLocationQuery = /(location|map|where|address|directions|how to (get|reach|find)|navigate)/i.test(message);

        // Add user message to UI
        appendMessage('user', message);
        inputField.value = '';
        inputField.style.height = 'auto';

        // Determine CTAs to show for this user query
        const ctaButtons = getCTAsForMessage(message);

        // Show typing indicator
        isTyping = true;
        const typingIndicator = showTypingIndicator();

        try {
            const response = await fetch(CHATBOT_CONFIG.workerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Project-ID': CHATBOT_CONFIG.projectId
                },
                body: JSON.stringify({
                    message: message,
                    model: CHATBOT_CONFIG.model,
                    systemInstruction: CHATBOT_CONFIG.systemInstruction
                })
            });

            const data = await response.json();
            
            // Remove typing indicator
            typingIndicator.remove();
            isTyping = false;

            if (data.success) {
                appendMessage('bot', data.message);
                // If the user asked about location, show the map
                if (lastUserMessageWasLocationQuery) {
                    appendMapWidget();
                    lastUserMessageWasLocationQuery = false;
                }
                // Append CTAs (if any) after bot response
                if (ctaButtons && ctaButtons.length) {
                    appendCTAs(ctaButtons);
                }
            } else {
                appendMessage('bot', "I'm sorry, I encountered an error. Please try again or call us!");
                console.error("Chatbot Error:", data.error);
            }
        } catch (error) {
            typingIndicator.remove();
            isTyping = false;
            appendMessage('bot', "I'm having trouble connecting right now. Please check your internet or call us.");
            console.error("Fetch Error:", error);
        }
    };

    sendBtn.addEventListener('click', handleSendMessage);

    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Auto-resize textarea
    inputField.addEventListener('input', () => {
        inputField.style.height = 'auto';
        inputField.style.height = (inputField.scrollHeight) + 'px';
    });

    // Helpers
    function getShortTime() {
        const d = new Date();
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Return CTA button definitions for a given user message
    // Only provide the requested CTAs: View Dining, View Menu, Booking, Reserve Table
    function getCTAsForMessage(msg) {
        const m = msg.toLowerCase();
        const ctas = [];

        if (/\b(menu|what's on the menu|view menu|menu\b)/i.test(m)) {
            ctas.push({ label: 'View Menu', target: 'menu.html' });
        }

        if (/\b(private|private dining|dining|events|private events)\b/i.test(m)) {
            ctas.push({ label: 'View Dining', target: 'private-dining.html' });
        }

        if (/\b(booking|book|reservation|reserve)\b/i.test(m)) {
            // Include both 'Booking' and 'Reserve Table' when user asks about booking/reservation
            ctas.push({ label: 'Booking', target: 'modal:reservation' });
            ctas.push({ label: 'Reserve Table', target: 'modal:reservation' });
        }

        return ctas;
    }

    // Append a set of CTA buttons into the chat as a single bot message
    function appendCTAs(buttons) {
        if (!buttons || !buttons.length) return;

        const ctaDiv = document.createElement('div');
        ctaDiv.className = 'message bot-message cta-message';

        const ctaContent = document.createElement('div');
        ctaContent.className = 'message-content';
        ctaContent.innerHTML = '<div class="cta-container"></div>';

        ctaDiv.appendChild(ctaContent);

        const container = ctaContent.querySelector('.cta-container');

        buttons.forEach(b => {
            const btn = document.createElement('button');
            btn.className = 'cta-btn';
            btn.innerText = b.label;
            btn.dataset.target = b.target;
            btn.addEventListener('click', (e) => {
                const tgt = e.currentTarget.dataset.target;
                handleCTAClick(tgt);
            });
            container.appendChild(btn);
        });

        // no timestamp for CTA messages (render simple buttons only)

        messagesContainer.appendChild(ctaDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function handleCTAClick(target) {
        if (!target) return;

        if (target.startsWith('modal:')) {
            const id = target.split(':')[1];
            try {
                const modalEl = document.getElementById(id + 'Modal') || document.getElementById(id);
                if (modalEl && window.bootstrap && window.bootstrap.Modal) {
                    const m = new window.bootstrap.Modal(modalEl);
                    m.show();
                } else if (modalEl) {
                    modalEl.style.display = 'block';
                }
            } catch (e) {
                console.error('Failed to open modal CTA:', e);
            }
            return;
        }

        if (target.startsWith('#')) {
            const id = target.slice(1);
            const el = document.getElementById(id);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // also update url hash
                history.replaceState(null, '', target);
            }
            return;
        }

        // External or page navigation
        if (/^https?:\/\//.test(target)) {
            window.open(target, '_blank');
            return;
        }

        // Default: navigate to page
        window.location.href = target;
    }

    function appendMessage(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // Simple formatting for bold and links
        let formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: inherit; text-decoration: underline;">$1</a>');

        // Handle newlines
        contentDiv.innerHTML = formattedText.replace(/\n/g, '<br>');

        // Timestamp
        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.innerText = getShortTime();

        msgDiv.appendChild(contentDiv);
        msgDiv.appendChild(timeSpan);
        messagesContainer.appendChild(msgDiv);

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    function appendMapWidget() {
        const mapDiv = document.createElement('div');
        mapDiv.className = 'message bot-message';
        
        const mapContent = document.createElement('div');
        mapContent.className = 'message-content map-widget';
        
        mapContent.innerHTML = `
            <div class="map-header">
                <span class="map-pin-icon">📍</span>
                <span class="map-title">Colchuck's Location</span>
            </div>
            <div class="map-container">
                <iframe 
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2686.8!2d-120.6615278!3d47.5961111!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x549a7a7a7a7a7a7a%3A0x7a7a7a7a7a7a7a7a!2sColchuck's%2C%20801%20Front%20St%2C%20Leavenworth%2C%20WA%2098826!5e0!3m2!1sen!2sus!4v1735456420000" 
                    width="100%" 
                    height="200" 
                    style="border:0; border-radius: 8px;" 
                    allowfullscreen="" 
                    loading="lazy" 
                    referrerpolicy="no-referrer-when-downgrade">
                </iframe>
            </div>
        `;
        
        mapDiv.appendChild(mapContent);
        // add timestamp for the map widget
        const mapTime = document.createElement('span');
        mapTime.className = 'message-time';
        mapTime.innerText = getShortTime();
        mapDiv.appendChild(mapTime);

        messagesContainer.appendChild(mapDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'typing';
        indicator.innerText = "Colchuck's is typing...";
        messagesContainer.appendChild(indicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return indicator;
    }
});
