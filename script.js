/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");

/* Arrays that keep track of our products:
   - allProducts: every product from products.json (loaded once)
   - currentProducts: the products showing in the grid right now
   - selectedProducts: the products the user has picked */
let allProducts = [];
let currentProducts = [];
let selectedProducts = [];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

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
      // Add the "selected" class if this product is already picked
      const selectedClass = isSelected(product.id) ? "selected" : "";

      // role="button" + tabindex="0" let keyboard users select cards too.
      // aria-pressed tells screen readers whether the card is selected.
      return `
    <div
      class="product-card ${selectedClass}"
      data-id="${product.id}"
      role="button"
      tabindex="0"
      aria-pressed="${isSelected(product.id)}"
    >
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
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
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <p class="empty-selection">No products selected yet. Click a product card to add it.</p>
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

  // Redraw both sections so they match the new selection
  displayProducts(currentProducts);
  displaySelectedProducts();
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Clicking a product card selects or unselects it.
   We listen on the whole grid and then find which card was clicked. */
productsContainer.addEventListener("click", (e) => {
  const card = e.target.closest(".product-card");
  if (card) {
    toggleProduct(Number(card.dataset.id));
  }
});

/* Let keyboard users select a card with Enter or Space */
productsContainer.addEventListener("keydown", (e) => {
  const card = e.target.closest(".product-card");
  if (card && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault(); // stop Space from scrolling the page
    toggleProduct(Number(card.dataset.id));
  }
});

/* Clicking the × on a selected product removes it */
selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest(".remove-btn");
  if (removeButton) {
    toggleProduct(Number(removeButton.dataset.id));
  }
});

/* Show the empty "Selected Products" message when the page first loads */
displaySelectedProducts();

/* Chat form submission handler - placeholder for OpenAI integration */
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  chatWindow.innerHTML = "Connect to the OpenAI API for a response!";
});
