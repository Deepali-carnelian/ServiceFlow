import { getJobs, subscribeJobs } from "../store/jobsStore.mjs";
import { formatDate } from "../utils/date.mjs";
import { escapeHtml, formatMoney, statusClass } from "../utils/format.mjs";
import { openJob } from "./jobDetails.mjs";

export function renderJobsTable() {
	const query = (document.getElementById("searchInput")?.value || "")
		.trim()
		.toLowerCase();
	const status = document.getElementById("statusFilter")?.value || "";

	const filtered = getJobs().filter((job) => {
		const searchable =
			`${job.customer} ${job.company} ${job.issue} ${job.equipment} ${job.phone}`.toLowerCase();
		return (
			(!query || searchable.includes(query)) &&
			(!status || job.status === status)
		);
	});

	const body = document.getElementById("jobsTableBody");
	body.innerHTML = filtered.length
		? filtered
				.map(
					(job) => `
        <tr>
          <td><strong>${escapeHtml(job.customer)}</strong><small>${escapeHtml(job.company || job.source)}</small></td>
          <td>${escapeHtml(job.issue)}</td>
          <td><span class="status ${statusClass(job.status)}">${escapeHtml(job.status)}</span></td>
          <td>${formatDate(job.lastContact)}</td>
          <td>${formatDate(job.nextFollowup)}</td>
          <td>${formatMoney(job.value)}</td>
          <td>
  <button
    class="action-btn"
    data-table-action="open"
    data-job-id="${job.id}"
  >
    Open
  </button>
</td>
        </tr>`,
				)
				.join("")
		: '<tr><td colspan="7" class="table-empty">No matching jobs.</td></tr>';
}

export function setupJobsTable() {
	document
		.getElementById("searchInput")
		.addEventListener("input", renderJobsTable);
	document
		.getElementById("statusFilter")
		.addEventListener("change", renderJobsTable);

	document
		.getElementById("jobsTableBody")
		.addEventListener("click", (event) => {
			const button = event.target.closest("[data-table-action]");
			if (!button) return;

			if (button.dataset.tableAction === "open") openJob(button.dataset.jobId);
		});

	subscribeJobs(renderJobsTable);
	renderJobsTable();
}
