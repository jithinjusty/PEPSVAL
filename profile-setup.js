document.addEventListener("DOMContentLoaded", () => {
  const addBtn = document.getElementById("addSeaService");
  const seaBody = document.getElementById("seaBody");
  const saveBtn = document.getElementById("saveBtn");
  const errorBox = document.getElementById("errorBox");

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  }
  function clearError() {
    errorBox.textContent = "";
    errorBox.style.display = "none";
  }

  function emptyRow() {
    return `
      <tr>
        <td colspan="7" class="empty">No sea service added yet.</td>
      </tr>
    `;
  }

  function hasOnlyEmpty() {
    return seaBody.querySelectorAll("tr").length === 1 &&
           seaBody.querySelector(".empty");
  }

  function makeRow() {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><input class="cellInput" data-k="vessel" type="text" placeholder="Vessel name" /></td>
      <td><input class="cellInput" data-k="company" type="text" placeholder="Company" /></td>
      <td><input class="cellInput" data-k="rank" type="text" placeholder="Rank" /></td>
      <td><input class="cellInput" data-k="from" type="date" /></td>
      <td><input class="cellInput" data-k="to" type="date" /></td>
      <td>
        <span class="status statusSelf">Self-declared</span>
      </td>
      <td style="white-space:nowrap;">
        <button type="button" class="rowBtn deleteBtn">Delete</button>
      </td>
    `;

    // Delete
    tr.querySelector(".deleteBtn").addEventListener("click", () => {
      tr.remove();
      if (seaBody.querySelectorAll("tr").length === 0) {
        seaBody.innerHTML = emptyRow();
      }
    });

    return tr;
  }

  // Add row
  addBtn.addEventListener("click", () => {
    clearError();

    // Remove empty row first
    if (seaBody.querySelector(".empty")) {
      seaBody.innerHTML = "";
    }

    seaBody.appendChild(makeRow());
  });

  // Save (temporary)
  saveBtn.addEventListener("click", () => {
    clearError();

    // Basic validation example: if seafarer and at least one entry exists, ensure vessel/company filled
    const rows = Array.from(seaBody.querySelectorAll("tr"));
    const emptyState = seaBody.querySelector(".empty");

    if (!emptyState && rows.length > 0) {
      for (const r of rows) {
        const vessel = r.querySelector('[data-k="vessel"]')?.value?.trim() || "";
        const company = r.querySelector('[data-k="company"]')?.value?.trim() || "";
        if (!vessel || !company) {
          return showError("Please fill at least Vessel and Company for each sea service entry.");
        }
      }
    }

    // Next step: save to Supabase
    window.location.href = "/dashboard.html";
  });

  // Start with empty row
  seaBody.innerHTML = emptyRow();
});