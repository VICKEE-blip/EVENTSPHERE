"use strict";

const ORDER_STORAGE_KEY = "eventsphereBooking";
const NOTIFICATION_EMAIL = "vickeeblib@gmail.com";
const MAX_PROOF_SIZE = 10 * 1024 * 1024;
const TICKET_TYPES = [
    { id: "earlyBird", name: "Early Bird", detail: "Limited-time discounted admission." },
    { id: "regular", name: "Regular", detail: "Standard event admission." },
    { id: "vip", name: "VIP", detail: "Priority access and VIP experience." }
];

const EVENTS = {
    kisumu: {
        id: "kisumu",
        name: "Kisumu Kalenjin Connect",
        date: "November 13, 2026",
        location: "Klub Dar Place, Kisumu",
        image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1800",
        description: "Join the Kisumu Kalenjin Connect for an evening of music, community and memorable live entertainment.",
        prices: { earlyBird: 3, regular: 5, vip: 10 }
    },
    "tech-summit": {
        id: "tech-summit",
        name: "Tech Summit 2027",
        date: "January 15, 2027",
        location: "Sarit Hall, Nairobi",
        image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1800",
        description: "Explore AI, startups and innovation with a day of ideas, practical sessions and conversations with the technology community.",
        prices: { earlyBird: 30, regular: 40, vip: 60 }
    }
};

function formatMoney(amount) {
    return `USD ${Number(amount).toFixed(2)}`;
}

function getStoredBooking() {
    try {
        const stored = localStorage.getItem(ORDER_STORAGE_KEY);
        if (!stored) return null;

        const booking = JSON.parse(stored);
        const eventInfo = booking && EVENTS[booking.eventId];
        const quantities = booking && booking.quantities;
        const validQuantities = eventInfo && quantities && TICKET_TYPES.every((ticket) => {
            return Number.isInteger(quantities[ticket.id]) && quantities[ticket.id] >= 0 && quantities[ticket.id] <= 10;
        });
        const ticketCount = validQuantities
            ? TICKET_TYPES.reduce((count, ticket) => count + quantities[ticket.id], 0)
            : 0;

        if (!validQuantities || ticketCount === 0) {
            console.warn("The saved booking is incomplete or invalid.");
            return null;
        }

        return {
            ...booking,
            total: calculateTotal(eventInfo, quantities)
        };
    } catch (error) {
        console.error("Could not read the saved Eventsphere booking.", error);
        return null;
    }
}

function saveBooking(booking) {
    try {
        localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(booking));
        return true;
    } catch (error) {
        console.error("Could not save the Eventsphere booking in this browser.", error);
        return false;
    }
}

function calculateTotal(eventInfo, quantities) {
    return TICKET_TYPES.reduce((total, ticket) => {
        return total + eventInfo.prices[ticket.id] * quantities[ticket.id];
    }, 0);
}

function ticketSummary(booking) {
    return TICKET_TYPES
        .filter((ticket) => booking.quantities[ticket.id] > 0)
        .map((ticket) => `${ticket.name} x ${booking.quantities[ticket.id]}`)
        .join(", ");
}

function initializeEventPage() {
    const eventId = new URLSearchParams(window.location.search).get("event");
    const eventInfo = EVENTS[eventId];
    const message = document.getElementById("eventMessage");
    const continueButton = document.getElementById("continueButton");

    if (!eventInfo) {
        document.getElementById("eventTitle").textContent = "Event not found";
        message.textContent = "This event link is not valid. Please choose an event from the events page.";
        return;
    }

    document.title = `${eventInfo.name} | Eventsphere`;
    document.getElementById("eventTitle").textContent = eventInfo.name;
    document.getElementById("eventDate").textContent = eventInfo.date;
    document.getElementById("eventLocation").textContent = eventInfo.location;
    document.getElementById("eventDescription").textContent = eventInfo.description;

    const image = document.getElementById("eventImage");
    image.src = eventInfo.image;
    image.alt = `${eventInfo.name} event`;

    const ticketOptions = document.getElementById("ticketOptions");
    ticketOptions.innerHTML = TICKET_TYPES.map((ticket) => `
        <div class="ticket-option">
            <div>
                <h3>${ticket.name}</h3>
                <p>${ticket.detail}</p>
                <span class="ticket-price">${formatMoney(eventInfo.prices[ticket.id])} each</span>
            </div>
            <label class="quantity-label" for="quantity-${ticket.id}">
                Quantity
                <input id="quantity-${ticket.id}" name="${ticket.id}" type="number" min="0" max="10" step="1" value="0" inputmode="numeric">
            </label>
        </div>
    `).join("");

    const quantityInputs = Array.from(ticketOptions.querySelectorAll("input[type='number']"));
    const updateSelection = () => {
        const quantities = Object.fromEntries(quantityInputs.map((input) => [input.name, Number(input.value)]));
        const count = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0);
        document.getElementById("selectionCount").textContent = count
            ? `${count} ticket${count === 1 ? "" : "s"} selected`
            : "No tickets selected";
        document.getElementById("selectionTotal").textContent = formatMoney(calculateTotal(eventInfo, quantities));
        continueButton.disabled = count === 0 || !quantityInputs.every((input) => input.validity.valid);
    };

    quantityInputs.forEach((input) => input.addEventListener("input", updateSelection));
    updateSelection();

    document.getElementById("ticketForm").addEventListener("submit", (submitEvent) => {
        submitEvent.preventDefault();
        if (!quantityInputs.every((input) => input.validity.valid)) {
            quantityInputs.find((input) => !input.validity.valid)?.reportValidity();
            return;
        }

        const quantities = Object.fromEntries(quantityInputs.map((input) => [input.name, Number(input.value)]));
        const total = calculateTotal(eventInfo, quantities);
        if (!total) {
            message.textContent = "Select at least one ticket to continue.";
            return;
        }

        const booking = {
            eventId: eventInfo.id,
            quantities,
            total,
            reference: `ES-${Date.now().toString(36).toUpperCase()}`,
            customer: null
        };
        if (!saveBooking(booking)) {
            message.textContent = "This browser could not save your selection. Please enable site storage and try again.";
            return;
        }
        window.location.href = "checkout.html";
    });
}

function initializeCheckoutPage() {
    const booking = getStoredBooking();
    const eventInfo = booking && EVENTS[booking.eventId];

    if (!booking || !eventInfo) {
        document.getElementById("checkoutMissing").hidden = false;
        return;
    }

    document.getElementById("checkoutContent").hidden = false;
    document.getElementById("checkoutEventName").textContent = eventInfo.name;
    document.getElementById("checkoutEventMeta").textContent = `${eventInfo.date} · ${eventInfo.location}`;

    const orderLines = document.getElementById("orderLines");
    TICKET_TYPES.filter((ticket) => booking.quantities[ticket.id] > 0).forEach((ticket) => {
        const quantity = booking.quantities[ticket.id];
        const lineTotal = eventInfo.prices[ticket.id] * quantity;
        const line = document.createElement("div");
        const description = document.createElement("span");
        const amount = document.createElement("strong");
        line.className = "order-line";
        description.textContent = `${ticket.name} × ${quantity}`;
        amount.textContent = formatMoney(lineTotal);
        line.append(description, amount);
        orderLines.append(line);
    });
    document.getElementById("checkoutTotal").textContent = formatMoney(booking.total);

    if (booking.customer) {
        document.getElementById("customerName").value = booking.customer.name || "";
        document.getElementById("customerEmail").value = booking.customer.email || "";
        document.getElementById("customerPhone").value = booking.customer.phone || "";
    }

    document.getElementById("checkoutForm").addEventListener("submit", (submitEvent) => {
        submitEvent.preventDefault();
        if (!submitEvent.currentTarget.reportValidity()) return;

        booking.customer = {
            name: document.getElementById("customerName").value.trim(),
            email: document.getElementById("customerEmail").value.trim(),
            phone: document.getElementById("customerPhone").value.trim()
        };
        if (!saveBooking(booking)) {
            document.getElementById("checkoutMessage").textContent = "Your booking details could not be saved in this browser. Please enable site storage and try again.";
            return;
        }
        window.location.href = "payment-pending.html";
    });
}

function initializePaymentPage() {
    const booking = getStoredBooking();
    const eventInfo = booking && EVENTS[booking.eventId];
    const submitted = new URLSearchParams(window.location.search).get("submitted") === "1";

    if (!booking || !eventInfo || !booking.customer) {
        document.getElementById("paymentMissing").hidden = false;
        return;
    }

    const reference = booking.reference || "Not available";
    if (submitted) {
        document.getElementById("pendingConfirmation").hidden = false;
        document.getElementById("confirmationReference").textContent = reference;
        document.getElementById("confirmationEvent").textContent = eventInfo.name;
        document.getElementById("confirmationTotal").textContent = formatMoney(booking.total);
        const contactSubject = encodeURIComponent(`Booking follow-up: ${reference}`);
        const contactBody = encodeURIComponent(`Hello Eventsphere, I have a question about booking ${reference} for ${eventInfo.name}.`);
        document.getElementById("contactButton").href = `mailto:${NOTIFICATION_EMAIL}?subject=${contactSubject}&body=${contactBody}`;
        return;
    }

    document.getElementById("paymentFormPanel").hidden = false;
    document.getElementById("paymentEventName").textContent = eventInfo.name;
    document.getElementById("bookingReference").textContent = reference;
    document.getElementById("paymentTotal").textContent = formatMoney(booking.total);
    document.getElementById("senderEmail").value = booking.customer.email;
    document.getElementById("emailSubject").value = `Payment proof: ${eventInfo.name} (${reference})`;
    document.getElementById("emailReference").value = reference;
    document.getElementById("emailEvent").value = `${eventInfo.name} — ${eventInfo.date} — ${eventInfo.location}`;
    document.getElementById("emailTickets").value = ticketSummary(booking);
    document.getElementById("emailTotal").value = formatMoney(booking.total);
    document.getElementById("emailCustomerName").value = booking.customer.name;
    document.getElementById("emailCustomerPhone").value = booking.customer.phone;

    const returnUrl = document.getElementById("returnUrl");
    const proofForm = document.getElementById("proofForm");
    const submitButton = document.getElementById("submitProof");
    const message = document.getElementById("proofMessage");
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
        returnUrl.value = new URL("payment-pending.html?submitted=1", window.location.href).href;
    } else {
        submitButton.disabled = true;
        message.textContent = "To send proof by email, open this site through a web host or local web server (not directly as a file).";
    }

    proofForm.addEventListener("submit", (submitEvent) => {
        const paidAmount = Number(document.getElementById("paidAmount").value);
        const expectedCents = Math.round(Number(booking.total) * 100);
        const paidCents = Math.round(paidAmount * 100);
        const fileInput = document.getElementById("paymentProof");
        const file = fileInput.files[0];

        if (paidCents !== expectedCents) {
            submitEvent.preventDefault();
            message.textContent = `The amount must exactly match ${formatMoney(booking.total)}.`;
            document.getElementById("paidAmount").focus();
            return;
        }

        if (!file) {
            submitEvent.preventDefault();
            message.textContent = "Please attach your payment voucher or receipt.";
            return;
        }

        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!isImage && !isPdf) {
            submitEvent.preventDefault();
            message.textContent = "Upload an image or PDF payment proof.";
            fileInput.focus();
            return;
        }
        if (file.size > MAX_PROOF_SIZE) {
            submitEvent.preventDefault();
            message.textContent = "The selected file is over the 10 MB limit. Choose a smaller proof file.";
            fileInput.focus();
        }
    });
}

const page = document.body.dataset.page;
if (page === "event") initializeEventPage();
if (page === "checkout") initializeCheckoutPage();
if (page === "payment") initializePaymentPage();
