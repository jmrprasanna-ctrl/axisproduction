                            
import { getData, postData, deleteData } from './api.js';

const loadInvoices = async () => {
    const invoices = await getData('invoices');
    const tbody = document.getElementById('invoice-table-body');
    tbody.innerHTML = '';
    invoices.forEach(inv => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${inv.invoice_no}</td>
            <td>${inv.customer_name}</td>
            <td>${inv.total}</td>
            <td>${new Date(inv.invoice_date).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-success" onclick="viewInvoice(${inv.id})">INV 1</button>
                <button class="btn btn-danger" onclick="deleteInvoice(${inv.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
};

window.loadInvoices = loadInvoices;

const deleteInvoice = async (id) => {
    if (confirm('Are you sure?')) {
        await deleteData(`invoices/${id}`);
        loadInvoices();
    }
};

window.deleteInvoice = deleteInvoice;

const viewInvoice = (id) => {
    window.location.href = `view-invoice.html?id=${id}`;
};

window.viewInvoice = viewInvoice;
