import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Hammer,
  Search,
  Wrench,
  XCircle,
} from "lucide-react";

const DEFAULT_MACHINES = [
  "Unassigned",
  "Bambu P1S",
  "Bambu X1C",
  "Bambu H2S",
  "H2S Laser — 10W",
  "H2S Laser — 40W",
  "H2S Cutter",
  "Assembly / Bench Work",
  "CAD / Design",
  "Packaging / Shipping",
];

const SCHEDULE_STATUSES = [
  "Not Scheduled",
  "Scheduled",
  "In Progress",
  "Blocked",
  "Ready for Pickup",
  "Ready to Ship",
  "Completed",
];

const DATE_FILTERS = ["All", "Today", "This Week", "Overdue", "Unscheduled"];

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateOnly(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function getDate(value) {
  if (!value) return null;
  const date = new Date(`${dateOnly(value)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getTime(value) {
  if (!value) return "";
  const pieces = String(value).split("T");
  return pieces[1]?.slice(0, 5) || "";
}

function combineDateTime(date, time) {
  if (!date) return "";
  return time ? `${date}T${time}` : `${date}T09:00`;
}

function formatDate(value) {
  const date = getDate(value);
  if (!date) return "Not scheduled";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getScheduledStart(job) {
  return job.scheduleStart || job.scheduledStart || job.productionStart || "";
}

function getScheduledEnd(job) {
  return job.scheduleEnd || job.scheduledEnd || job.productionEnd || "";
}

function getScheduledMachine(job) {
  return job.scheduleMachine || job.assignedMachine || job.machine || "Unassigned";
}

function getScheduledOperator(job) {
  return job.scheduleOperator || job.operator || "";
}

function getScheduleStatus(job) {
  return job.scheduleStatus || (getScheduledStart(job) ? "Scheduled" : "Not Scheduled");
}

function getEstimatedScheduleHours(job) {
  if (num(job.estimatedScheduleHours) > 0) return num(job.estimatedScheduleHours);

  const formData = job.quoteSnapshot?.formData || job.formData || {};
  const printRuns = formData.printRuns || [];
  const quotedPrintHours = printRuns.reduce(
    (sum, run) => sum + num(run.printHours || run.machineHours || run.hours),
    0
  );

  const fallback =
    quotedPrintHours ||
    num(formData.machineHours) ||
    num(formData.cadHours) ||
    num(job.totals?.machineHours) ||
    1;

  return Math.max(0.25, fallback);
}

function isScheduled(job) {
  return Boolean(getScheduledStart(job));
}

function isScheduleOverdue(job) {
  const start = getDate(getScheduledStart(job));
  if (!start || job.archived || job.status === "Completed" || getScheduleStatus(job) === "Completed") return false;

  const today = getDate(todayDateString());
  return start < today;
}

function isToday(job) {
  return dateOnly(getScheduledStart(job)) === todayDateString();
}

function isThisWeek(job) {
  const start = getDate(getScheduledStart(job));
  if (!start) return false;

  const today = getDate(todayDateString());
  const weekEnd = addDays(today, 6);
  return start >= today && start <= weekEnd;
}

function matchesSearch(job, searchTerm) {
  const search = searchTerm.trim().toLowerCase();
  if (!search) return true;

  return [
    job.jobNumber,
    job.quoteNumber,
    job.invoiceNumber,
    job.customerName,
    job.customerPhone,
    job.customerEmail,
    job.jobName,
    job.status,
    job.priority,
    job.dueDate,
    getScheduledMachine(job),
    getScheduledOperator(job),
    getScheduleStatus(job),
    job.scheduleNotes,
    job.queueNotes,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(search));
}

function matchesDateFilter(job, filter) {
  if (filter === "All") return true;
  if (filter === "Today") return isToday(job);
  if (filter === "This Week") return isThisWeek(job);
  if (filter === "Overdue") return isScheduleOverdue(job);
  if (filter === "Unscheduled") return !isScheduled(job);
  return true;
}

function sortScheduleJobs(jobs) {
  return [...jobs].sort((a, b) => {
    const aScheduled = getScheduledStart(a);
    const bScheduled = getScheduledStart(b);

    if (aScheduled && bScheduled) return new Date(aScheduled) - new Date(bScheduled);
    if (aScheduled && !bScheduled) return -1;
    if (!aScheduled && bScheduled) return 1;

    const priorityRank = { Rush: 4, High: 3, Normal: 2, Low: 1 };
    return (priorityRank[b.priority || "Normal"] || 2) - (priorityRank[a.priority || "Normal"] || 2);
  });
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="dashboard-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {Icon && <Icon size={20} />}
    </div>
  );
}

export default function SchedulePage({ jobs = [], onUpdateJob }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [machineFilter, setMachineFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("This Week");
  const [expandedJobId, setExpandedJobId] = useState("");

  const activeJobs = jobs.filter((job) => !job.archived && job.status !== "Cancelled");

  const machines = useMemo(() => {
    const jobMachines = activeJobs.map(getScheduledMachine).filter(Boolean);
    return ["All", ...new Set([...DEFAULT_MACHINES, ...jobMachines])];
  }, [activeJobs]);

  const scheduledJobs = activeJobs.filter(isScheduled);
  const unscheduledJobs = activeJobs.filter((job) => !isScheduled(job));
  const overdueJobs = activeJobs.filter(isScheduleOverdue);
  const todayJobs = activeJobs.filter(isToday);
  const thisWeekJobs = activeJobs.filter(isThisWeek);

  const filteredJobs = useMemo(() => {
    return sortScheduleJobs(
      activeJobs.filter((job) => {
        const machineMatches =
          machineFilter === "All" || getScheduledMachine(job) === machineFilter;

        return (
          matchesSearch(job, searchTerm) &&
          machineMatches &&
          matchesDateFilter(job, dateFilter)
        );
      })
    );
  }, [activeJobs, searchTerm, machineFilter, dateFilter]);

  const machineGroups = useMemo(() => {
    const groups = new Map();

    scheduledJobs.forEach((job) => {
      const machine = getScheduledMachine(job);
      if (!groups.has(machine)) groups.set(machine, []);
      groups.get(machine).push(job);
    });

    return [...groups.entries()]
      .map(([machine, groupJobs]) => ({
        machine,
        jobs: sortScheduleJobs(groupJobs),
        hours: groupJobs.reduce((sum, job) => sum + getEstimatedScheduleHours(job), 0),
        value: groupJobs.reduce((sum, job) => sum + num(job.finalTotal), 0),
      }))
      .sort((a, b) => a.machine.localeCompare(b.machine));
  }, [scheduledJobs]);

  const weekDays = useMemo(() => {
    const today = getDate(todayDateString());

    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index);
      const iso = date.toISOString().slice(0, 10);
      const dayJobs = scheduledJobs.filter((job) => dateOnly(getScheduledStart(job)) === iso);

      return {
        iso,
        label: date.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        jobs: sortScheduleJobs(dayJobs),
        hours: dayJobs.reduce((sum, job) => sum + getEstimatedScheduleHours(job), 0),
        value: dayJobs.reduce((sum, job) => sum + num(job.finalTotal), 0),
      };
    });
  }, [scheduledJobs]);

  function updateSchedule(jobId, updates) {
    onUpdateJob(jobId, {
      ...updates,
      scheduleUpdatedAt: new Date().toISOString(),
    });
  }

  function quickScheduleToday(job) {
    const now = new Date();
    const startHour = Math.max(9, now.getHours() + 1);
    const startTime = `${String(startHour).padStart(2, "0")}:00`;
    const endTime = `${String(startHour + Math.ceil(getEstimatedScheduleHours(job))).padStart(2, "0")}:00`;

    updateSchedule(job.id, {
      scheduleStart: combineDateTime(todayDateString(), startTime),
      scheduleEnd: combineDateTime(todayDateString(), endTime),
      scheduleStatus: "Scheduled",
    });
  }

  function clearSchedule(job) {
    const confirmed = window.confirm(`Clear schedule for ${job.jobNumber || "this job"}?`);
    if (!confirmed) return;

    updateSchedule(job.id, {
      scheduleStart: "",
      scheduleEnd: "",
      scheduleMachine: "Unassigned",
      scheduleStatus: "Not Scheduled",
      scheduleNotes: "",
    });
  }

  function renderJobScheduleCard(job) {
    const isExpanded = expandedJobId === job.id;
    const scheduledStart = getScheduledStart(job);
    const scheduledEnd = getScheduledEnd(job);
    const machine = getScheduledMachine(job);
    const operator = getScheduledOperator(job);
    const status = getScheduleStatus(job);
    const overdue = isScheduleOverdue(job);

    return (
      <article className={`schedule-job-card ${overdue ? "schedule-overdue" : ""}`} key={job.id}>
        <button
          className="schedule-job-header"
          type="button"
          onClick={() => setExpandedJobId(isExpanded ? "" : job.id)}
        >
          <div>
            <strong>{job.jobNumber || "Job"} — {job.customerName || "No Customer"}</strong>
            <span>{job.jobName || "Untitled Job"}</span>
            <small>
              {scheduledStart ? formatDateTime(scheduledStart) : "Unscheduled"}
              {scheduledEnd ? ` → ${formatDateTime(scheduledEnd)}` : ""}
            </small>
          </div>

          <div className="dashboard-status-stack">
            {overdue && <span className="status-pill">Overdue</span>}
            <span className="status-pill">{machine}</span>
            <span className="status-pill">{status}</span>
            <strong>{money(job.finalTotal)}</strong>
          </div>
        </button>

        {isExpanded && (
          <div className="schedule-job-body">
            <div className="form-grid">
              <label className="field">
                <span>Schedule Status</span>
                <select
                  value={status}
                  onChange={(event) => updateSchedule(job.id, { scheduleStatus: event.target.value })}
                >
                  {SCHEDULE_STATUSES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Assigned Machine / Station</span>
                <select
                  value={machine}
                  onChange={(event) => updateSchedule(job.id, { scheduleMachine: event.target.value })}
                >
                  {DEFAULT_MACHINES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Start Date</span>
                <input
                  type="date"
                  value={dateOnly(scheduledStart)}
                  onChange={(event) =>
                    updateSchedule(job.id, {
                      scheduleStart: combineDateTime(event.target.value, getTime(scheduledStart) || "09:00"),
                      scheduleStatus: event.target.value ? "Scheduled" : status,
                    })
                  }
                />
              </label>

              <label className="field">
                <span>Start Time</span>
                <input
                  type="time"
                  value={getTime(scheduledStart) || "09:00"}
                  onChange={(event) =>
                    updateSchedule(job.id, {
                      scheduleStart: combineDateTime(dateOnly(scheduledStart) || todayDateString(), event.target.value),
                      scheduleStatus: "Scheduled",
                    })
                  }
                />
              </label>

              <label className="field">
                <span>End Date</span>
                <input
                  type="date"
                  value={dateOnly(scheduledEnd)}
                  onChange={(event) =>
                    updateSchedule(job.id, {
                      scheduleEnd: combineDateTime(event.target.value, getTime(scheduledEnd) || "17:00"),
                    })
                  }
                />
              </label>

              <label className="field">
                <span>End Time</span>
                <input
                  type="time"
                  value={getTime(scheduledEnd) || "17:00"}
                  onChange={(event) =>
                    updateSchedule(job.id, {
                      scheduleEnd: combineDateTime(dateOnly(scheduledEnd) || dateOnly(scheduledStart) || todayDateString(), event.target.value),
                    })
                  }
                />
              </label>

              <label className="field">
                <span>Operator / Owner</span>
                <input
                  type="text"
                  value={operator}
                  onChange={(event) =>
                    updateSchedule(job.id, {
                      scheduleOperator: event.target.value,
                      operator: event.target.value,
                    })
                  }
                />
              </label>

              <label className="field">
                <span>Estimated Hours</span>
                <input
                  type="number"
                  step="0.25"
                  value={job.estimatedScheduleHours || getEstimatedScheduleHours(job)}
                  onChange={(event) =>
                    updateSchedule(job.id, {
                      estimatedScheduleHours: event.target.value,
                    })
                  }
                />
              </label>
            </div>

            <label className="field single-row-gap">
              <span>Schedule Notes</span>
              <textarea
                value={job.scheduleNotes || ""}
                onChange={(event) => updateSchedule(job.id, { scheduleNotes: event.target.value })}
                placeholder="Material must arrive first, print overnight, customer pickup Friday, batch with similar color, etc."
              />
            </label>

            <div className="record-button-row quote-button-row single-row-gap">
              <button className="secondary-button" type="button" onClick={() => quickScheduleToday(job)}>
                <Clock size={18} />
                Schedule Today
              </button>

              <button className="secondary-button danger-button" type="button" onClick={() => clearSchedule(job)}>
                <XCircle size={18} />
                Clear Schedule
              </button>
            </div>
          </div>
        )}
      </article>
    );
  }

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Production Schedule</h2>
          <p className="muted-text">
            Schedule jobs by date, time, machine/station, and operator. This works with the existing job queue and timer system.
          </p>
        </div>
      </div>

      <div className="dashboard-stat-grid">
        <StatCard label="Scheduled Jobs" value={scheduledJobs.length} icon={CalendarDays} />
        <StatCard label="Today" value={todayJobs.length} icon={Clock} />
        <StatCard label="This Week" value={thisWeekJobs.length} icon={Hammer} />
        <StatCard label="Unscheduled" value={unscheduledJobs.length} icon={AlertTriangle} />
        <StatCard label="Schedule Overdue" value={overdueJobs.length} icon={AlertTriangle} />
        <StatCard
          label="Week Hours"
          value={weekDays.reduce((sum, day) => sum + day.hours, 0).toFixed(1)}
          icon={Wrench}
        />
      </div>

      <div className="schedule-week-grid">
        {weekDays.map((day) => (
          <div className="schedule-day-card" key={day.iso}>
            <div className="schedule-day-header">
              <strong>{day.label}</strong>
              <span>{day.hours.toFixed(1)} hr</span>
            </div>

            {day.jobs.length === 0 ? (
              <p className="muted-text">No jobs scheduled.</p>
            ) : (
              <div className="schedule-mini-list">
                {day.jobs.map((job) => (
                  <button
                    key={job.id}
                    className="schedule-mini-job"
                    type="button"
                    onClick={() => setExpandedJobId(job.id)}
                  >
                    <strong>{job.jobNumber}</strong>
                    <span>{getScheduledMachine(job)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="form-card single-row-gap">
        <h3 className="card-title">Machine / Station Load</h3>

        {machineGroups.length === 0 ? (
          <p className="muted-text">No scheduled machine load yet.</p>
        ) : (
          <div className="schedule-machine-grid">
            {machineGroups.map((group) => (
              <div className="schedule-machine-card" key={group.machine}>
                <div className="schedule-day-header">
                  <strong>{group.machine}</strong>
                  <span>{group.hours.toFixed(1)} hr</span>
                </div>

                <p className="helper-note">
                  {group.jobs.length} job{group.jobs.length === 1 ? "" : "s"} • {money(group.value)} scheduled value
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="filter-toolbar single-row-gap">
        <label className="search-field">
          <Search size={18} />
          <input
            type="search"
            value={searchTerm}
            placeholder="Search schedule by job, customer, machine, operator, status, notes..."
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <label className="filter-select-field">
          <span>Date</span>
          <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
            {DATE_FILTERS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="filter-select-field">
          <span>Machine</span>
          <select value={machineFilter} onChange={(event) => setMachineFilter(event.target.value)}>
            {machines.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <div className="filter-count-pill">
          Showing {filteredJobs.length} of {activeJobs.length}
        </div>
      </div>

      <div className="jobs-stack single-row-gap">
        {filteredJobs.length === 0 ? (
          <div className="empty-state">
            <h3>No matching scheduled work.</h3>
            <p>Try another filter or schedule jobs from the unscheduled queue.</p>
          </div>
        ) : (
          filteredJobs.map(renderJobScheduleCard)
        )}
      </div>
    </section>
  );
}
