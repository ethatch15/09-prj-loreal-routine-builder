/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const generateRoutineBtn = document.getElementById("generateRoutine");
const clearAllBtn = document.getElementById("clearAll");
const dirToggle = document.getElementById("dirToggle");
const webSearchToggle = document.getElementById("webSearchToggle");
const dirToggleLabel = document.getElementById("dirToggleLabel");

/* The address of your Cloudflare Worker.
   The Worker holds the OpenAI API key and forwards our request to OpenAI,
   so no key ever goes in this file. This URL is safe to share. */
const WORKER_URL = "https://loreal-chatbot.ethatch15.workers.dev/";

/* The system prompt tells the AI who it is and what it may talk about.
   It is always the first message in the conversation. */
const systemPrompt = `You are a friendly, expert L'Oréal beauty advisor. You build personalized routines using products from L'Oréal's family of brands (such as CeraVe, L'Oréal Paris, Garnier, Lancôme, La Roche-Posay, Vichy, and more).

When the user sends you a list of selected products as JSON:
- Build a clear step-by-step routine using ONLY those products.
- Split it into Morning and/or Evening (or a single routine for haircare, makeup, or fragrance), whichever makes sense.
- For each step, name the product and say briefly how and why to use it.
- If a product doesn't fit a routine well, or an important step is missing (like sunscreen in the morning), say so kindly.

Rules:
- After the routine, the user may ask follow-up questions. Answer them using the whole conversation so far (the routine you made, the products, and anything the user has told you, like their name or skin type).
- Only talk about the routine, the selected products, and beauty topics like skincare, haircare, makeup, fragrance, and grooming. Politely decline anything unrelated and invite a beauty question instead.
- Do not give medical advice. For serious skin conditions, suggest seeing a dermatologist.
- Write in plain text only, in every language. Do not use Markdown symbols like ** or #. Use numbered steps and simple headings like "Morning:" and "Evening:".
- Keep it friendly and easy to follow.
- When web search is available, use it for current information (new products, prices, availability, recent news) and prefer official L'Oréal brand websites and other trusted sources. Sources are shown to the user separately, so don't paste raw links in your answer.
- Reply in the same language the user writes in (for example, answer in Arabic if they write in Arabic).`;

/* Conversation history.
   OpenAI doesn't remember past messages on its own, so we keep EVERY
   message here and send the whole array each time. That lets the AI
   answer follow-up questions about the routine it already made. */
const messages = [{ role: "system", content: systemPrompt }];

/* Arrays that keep track of our products:
   - allProducts: every product from products.json (loaded once)
   - currentProducts: the products showing in the grid right now
   - selectedProducts: the products the user has picked */
let allProducts = [];
let currentProducts = [];
let selectedProducts = [];

/* IDs of the products whose descriptions are currently open */
let openDescriptions = [];

/* Show initial placeholder until user picks a category or searches */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Choose a category or search to view products
  </div>
`;

/* —— Saving selections with localStorage ——
   localStorage is a small storage box in the browser that keeps data
   even after the page is reloaded or closed. It can only store text,
   so we turn our array into text with JSON.stringify() to save it,
   and back into an array with JSON.parse() to load it. */
const STORAGE_KEY = "lorealSelectedProducts";

/* Save the current selections to localStorage */
function saveSelections() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedProducts));
}

/* Load saved selections (or an empty list if nothing was saved yet) */
function loadSavedSelections() {
  const savedText = localStorage.getItem(STORAGE_KEY);

  // Nothing saved yet, so start with an empty list
  if (!savedText) {
    return [];
  }

  // try/catch: if the saved text is somehow broken, start fresh instead of crashing
  try {
    return JSON.parse(savedText);
  } catch (error) {
    return [];
  }
}

/* Fill the selected list with anything saved from a previous visit */
selectedProducts = loadSavedSelections();

/* Load product data from JSON file */
async function loadProducts() {
  // Only download the file the first time; after that, reuse what we have
  if (allProducts.length === 0) {
    const response = await fetch("products.json");
    const data = await response.json();
    allProducts = data.products;
  }
  return allProducts;
}

/* Check if a product is already selected.
   some() returns true if ANY item in the array matches. */
function isSelected(productId) {
  return selectedProducts.some((product) => product.id === productId);
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  // Remember which products are on screen so we can redraw them later
  currentProducts = products;

  productsContainer.innerHTML = products
    .map((product) => {
      // Is this product picked? Is its description open?
      const selected = isSelected(product.id);
      const descriptionOpen = openDescriptions.includes(product.id);

      // Change the classes, labels, and icons based on those answers
      const selectedClass = selected ? "selected" : "";
      const selectLabel = selected ? "Selected" : "Select";
      const selectIcon = selected ? "fa-check" : "fa-plus";
      const detailsLabel = descriptionOpen ? "Hide details" : "Details";
      const detailsIcon = descriptionOpen ? "fa-chevron-up" : "fa-chevron-down";

      // Each card has two real buttons, so keyboard and screen reader
      // users can use them too:
      // - Select (aria-pressed says whether it's selected)
      // - Details (aria-expanded says whether the description is showing)
      return `
    <div class="product-card ${selectedClass}" data-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p class="product-brand">${product.brand}</p>

        <div class="card-actions">
          <button class="select-btn" aria-pressed="${selected}">
            <i class="fa-solid ${selectIcon}"></i> ${selectLabel}
          </button>
          <button
            class="details-btn"
            aria-expanded="${descriptionOpen}"
            aria-controls="desc-${product.id}"
          >
            ${detailsLabel} <i class="fa-solid ${detailsIcon}"></i>
          </button>
        </div>
      </div>

      <!-- The description is hidden until the Details button is clicked -->
      <p
        class="product-description"
        id="desc-${product.id}"
        ${descriptionOpen ? "" : "hidden"}
      >
        ${product.description}
      </p>

      <span class="selected-badge" aria-hidden="true">
        <i class="fa-solid fa-check"></i>
      </span>
    </div>
  `;
    })
    .join("");
}

/* Show the selected products in the "Selected Products" section */
function displaySelectedProducts() {
  // If nothing is selected, show a friendly hint instead
  // Only show "Clear all" when there is something to clear
  clearAllBtn.hidden = selectedProducts.length === 0;

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <p class="empty-selection">No products selected yet. Click a product card or its Select button to add it.</p>
    `;
    return;
  }

  // Otherwise, show one "chip" per product, each with a remove (×) button
  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
    <div class="selected-item">
      <span>${product.name}</span>
      <button
        class="remove-btn"
        data-id="${product.id}"
        aria-label="Remove ${product.name}"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `
    )
    .join("");
}

/* Add a product if it isn't selected yet, or remove it if it is */
function toggleProduct(productId) {
  if (isSelected(productId)) {
    // filter() keeps every product EXCEPT the one we're removing
    selectedProducts = selectedProducts.filter(
      (product) => product.id !== productId
    );
  } else {
    // find() gets the full product object so we can save it
    const product = allProducts.find((item) => item.id === productId);
    selectedProducts.push(product);
  }

  // Save the new selection so it survives a page reload
  saveSelections();

  // Redraw both sections so they match the new selection
  displayProducts(currentProducts);
  displaySelectedProducts();
}

/* Show the products that match BOTH the category and the search box.
   This runs whenever either one changes. */
async function updateProductGrid() {
  const products = await loadProducts();
  const selectedCategory = categoryFilter.value; // "" means All Categories

  // toLowerCase() so "CERAVE", "CeraVe", and "cerave" all match
  const searchText = productSearch.value.trim().toLowerCase();

  // Nothing chosen and nothing typed yet: show the starting message
  if (selectedCategory === "" && searchText === "") {
    currentProducts = [];
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Choose a category or search to view products
      </div>
    `;
    return;
  }

  /* filter() creates a new array with only the products that pass
     BOTH checks below */
  const filteredProducts = products.filter((product) => {
    // Check 1: category matches (or "All Categories" is chosen)
    const categoryMatches =
      selectedCategory === "" || product.category === selectedCategory;

    // Check 2: the search text appears in the name, brand, category,
    // or description (an empty search box matches everything)
    const searchableText = `${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();
    const searchMatches = searchableText.includes(searchText);

    return categoryMatches && searchMatches;
  });

  // No matches: tell the user instead of showing an empty grid
  if (filteredProducts.length === 0) {
    currentProducts = [];
    productsContainer.innerHTML = `<div class="placeholder-message"></div>`;

    // Use textContent for the user's words so typed HTML is shown as plain text
    productsContainer.querySelector(".placeholder-message").textContent =
      `No products match "${productSearch.value.trim()}". Try another word or category.`;
    return;
  }

  displayProducts(filteredProducts);
}

/* Update the grid when the category changes... */
categoryFilter.addEventListener("change", updateProductGrid);

/* ...and every time the user types in the search box */
productSearch.addEventListener("input", updateProductGrid);

/* Show or hide a product's description */
function toggleDescription(productId) {
  if (openDescriptions.includes(productId)) {
    // Already open, so close it
    openDescriptions = openDescriptions.filter((id) => id !== productId);
  } else {
    // Closed, so open it
    openDescriptions.push(productId);
  }
  displayProducts(currentProducts);
}

/* Handle clicks anywhere in the product grid.
   We listen on the whole grid and then figure out what was clicked. */
productsContainer.addEventListener("click", (e) => {
  const card = e.target.closest(".product-card");
  // Ignore clicks outside a card, or on the description text
  // (so people can read or highlight it without selecting the product)
  if (!card || e.target.closest(".product-description")) {
    return;
  }
  const productId = Number(card.dataset.id);

  if (e.target.closest(".details-btn")) {
    // The Details button opens/closes the description (it does NOT select)
    toggleDescription(productId);
    focusCardButton(productId, ".details-btn");
  } else {
    // Clicking the Select button, or anywhere else on the card, selects it
    toggleProduct(productId);
    if (e.target.closest(".select-btn")) {
      focusCardButton(productId, ".select-btn");
    }
  }
});

/* After the grid is redrawn, put keyboard focus back on the same button,
   so keyboard users don't lose their place */
function focusCardButton(productId, buttonClass) {
  const button = productsContainer.querySelector(
    `.product-card[data-id="${productId}"] ${buttonClass}`
  );
  if (button) {
    button.focus();
  }
}

/* Clicking the × on a selected product removes it */
selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest(".remove-btn");
  if (removeButton) {
    toggleProduct(Number(removeButton.dataset.id));
  }
});

/* "Clear all" removes every selected product at once */
clearAllBtn.addEventListener("click", () => {
  selectedProducts = []; // empty the list
  saveSelections(); // save the empty list to localStorage

  // Redraw both sections
  displayProducts(currentProducts);
  displaySelectedProducts();
});

/* When the page first loads, show any saved selections
   (or the "No products selected yet" message) */
displaySelectedProducts();

/* addMessage() puts one chat bubble in the chat window.
   role is "user" or "ai" — it matches the .msg.user / .msg.ai styles.
   It returns the new bubble so we can change its text later. */
function addMessage(role, text) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("msg", role);

  // textContent (not innerHTML) shows the text exactly as written
  messageDiv.textContent = text;

  // dir="auto" lets each bubble pick its own text direction:
  // Arabic or Hebrew text reads right-to-left, English reads left-to-right
  messageDiv.dir = "auto";

  chatWindow.appendChild(messageDiv);

  // Scroll down so the newest message is visible
  chatWindow.scrollTop = chatWindow.scrollHeight;

  return messageDiv;
}

/* sendToAI() sends the whole conversation to the Cloudflare Worker
   and returns the AI's reply: { content: "the text", sources: [...] } */
async function sendToAI() {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages,
      // true = the Worker lets the AI search the web for current info
      webSearch: webSearchToggle.checked,
    }),
  });

  const data = await response.json();

  // If OpenAI sent back an error (bad key, no credits, etc.), stop here
  if (data.error) {
    throw new Error(data.error.message);
  }

  const message = data.choices[0].message;
  return {
    content: message.content,
    sources: message.sources || [], // only web search answers have sources
  };
}

/* showSources() adds a "Sources" list of clickable links under an AI bubble */
function showSources(bubble, sources) {
  if (sources.length === 0) {
    return; // no web search, or no links were used
  }

  const sourcesDiv = document.createElement("div");
  sourcesDiv.classList.add("sources");

  const heading = document.createElement("p");
  heading.classList.add("sources-title");
  heading.textContent = "Sources";
  sourcesDiv.appendChild(heading);

  const list = document.createElement("ol");
  sources.forEach((source) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = source.url;
    link.textContent = source.title;
    link.target = "_blank"; // open in a new tab
    link.rel = "noopener noreferrer"; // safer for links that open new tabs
    item.appendChild(link);
    list.appendChild(item);
  });
  sourcesDiv.appendChild(list);

  bubble.appendChild(sourcesDiv);
}

/* Generate Routine button */
generateRoutineBtn.addEventListener("click", async () => {
  // 1. Make sure at least one product is selected
  if (selectedProducts.length === 0) {
    addMessage(
      "ai",
      "Please select at least one product first, then click Generate Routine."
    );
    return;
  }

  // 2. Collect only the details the AI needs from each selected product
  const productData = selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));

  // 3. Build the request. JSON.stringify turns the array into text;
  //    the "null, 2" part just makes it neatly indented.
  const request = `Please build a personalized routine using these selected products:\n${JSON.stringify(
    productData,
    null,
    2
  )}`;

  // Add the request to the conversation history
  messages.push({ role: "user", content: request });

  // Show a short, friendly version in the chat (not the raw JSON)
  const productNames = selectedProducts.map((product) => product.name);
  addMessage("user", `Build my routine with: ${productNames.join(", ")}`);

  // Show a "working" bubble and disable the button so it isn't clicked twice
  const replyDiv = addMessage("ai", "Building your routine…");
  generateRoutineBtn.disabled = true;

  try {
    // 4. Send everything to the AI and show the routine it returns
    const routine = await sendToAI();
    replyDiv.textContent = routine.content;
    showSources(replyDiv, routine.sources); // links, if the web was searched

    // Save the AI's routine in the history for follow-up questions
    messages.push({ role: "assistant", content: routine.content });
  } catch (error) {
    console.error("Routine request failed:", error);
    replyDiv.textContent = `⚠️ Sorry, something went wrong: ${error.message}`;

    // Remove the unanswered request so the history stays tidy
    messages.pop();
  }

  // Turn the button back on and scroll to the bottom
  generateRoutineBtn.disabled = false;
  chatWindow.scrollTop = chatWindow.scrollHeight;
});

/* Chat form: lets the user ask follow-up questions about their routine */
chatForm.addEventListener("submit", async (e) => {
  // Stop the page from reloading (the default form behavior)
  e.preventDefault();

  // 1. Capture what the user typed (trim removes extra spaces)
  const question = userInput.value.trim();
  if (!question) {
    return; // nothing typed, so do nothing
  }

  // Show the question as a bubble and add it to the conversation history
  addMessage("user", question);
  messages.push({ role: "user", content: question });

  // Clear the box, and turn off Send while we wait for the AI
  userInput.value = "";
  sendBtn.disabled = true;
  const replyDiv = addMessage("ai", "Thinking…");

  try {
    // 2. Send the WHOLE conversation (system prompt, routine, past
    //    questions and answers) so the AI understands the follow-up
    const reply = await sendToAI();
    replyDiv.textContent = reply.content;
    showSources(replyDiv, reply.sources); // links, if the web was searched

    // 3. Save the answer in the history for the next question
    messages.push({ role: "assistant", content: reply.content });
  } catch (error) {
    console.error("Chat request failed:", error);
    replyDiv.textContent = `⚠️ Sorry, something went wrong: ${error.message}`;

    // Remove the unanswered question so the history stays tidy
    messages.pop();
  }

  // Turn Send back on, put the cursor back in the box, and scroll down
  sendBtn.disabled = false;
  userInput.focus();
  chatWindow.scrollTop = chatWindow.scrollHeight;
});

/* —— Right-to-left (RTL) language support ——
   Setting dir="rtl" on the <html> tag flips the whole layout:
   the product grid, the selected products, and the chat bubbles.
   We save the choice in localStorage so it stays after a reload. */
const DIRECTION_KEY = "lorealTextDirection";

function setDirection(direction) {
  // "rtl" = right-to-left (Arabic), "ltr" = left-to-right (English)
  document.documentElement.dir = direction;
  document.documentElement.lang = direction === "rtl" ? "ar" : "en";

  // The button always offers the OTHER option
  dirToggleLabel.textContent =
    direction === "rtl" ? "English (LTR)" : "العربية (RTL)";

  localStorage.setItem(DIRECTION_KEY, direction);
}

/* Flip the direction when the button is clicked */
dirToggle.addEventListener("click", () => {
  const isRTL = document.documentElement.dir === "rtl";
  setDirection(isRTL ? "ltr" : "rtl");
});

/* Use the saved direction (or left-to-right the first time) */
setDirection(localStorage.getItem(DIRECTION_KEY) || "ltr");
