import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCrm } from '../../store/CrmContext';
import { ContactStatus } from '../../types';
import { formatKrCompact, formatRelativeTouch, OPEN_STAGES } from '../../utils/format';
import { animateCards, animateRows, gsap, isReducedMotion } from '../../utils/motion';
import { ContactAvatar } from '../Avatar';
import { AnimatedTitle, MagneticButton, SlidingSeg, SlidingTabs, SwapView } from '../Motion';
import { IconBuilding, IconPlus, IconSearch } from '../Icons';

type PeopleSort = 'name' | 'company' | 'status' | 'owner' | 'lastTouch';

export const ContactsPage: React.FC = () => {
  const { space, route, navigate, openDrawer, openModal } = useCrm();
  const activeTab = (route.sub === 'companies' ? 'companies' : 'people') as 'people' | 'companies';
  const [tabDir, setTabDir] = useState(1);

  const [peopleQuery, setPeopleQuery] = useState('');
  const [companyQuery, setCompanyQuery] = useState(route.query.q || '');
  const [statusFilter, setStatusFilter] = useState<'all' | ContactStatus>('all');
  const [sortKey, setSortKey] = useState<PeopleSort>('lastTouch');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const contentRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (route.query.q) setCompanyQuery(route.query.q);
  }, [route.query.q]);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || isReducedMotion()) return;
    const ctx = gsap.context(() => {
      if (activeTab === 'people') {
        animateCards(el.querySelectorAll('.card'));
        animateRows(el.querySelectorAll('tbody tr'), { stagger: 0.02, delay: 0.2 });
      } else {
        animateCards(el.querySelectorAll('.company-card'), { stagger: 0.04 });
      }
    }, el);
    return () => ctx.revert();
  }, [activeTab, space.id]);

  const companyMap = useMemo(
    () => new Map(space.companies.map((c) => [c.id, c])),
    [space.companies]
  );
  const repMap = useMemo(() => new Map(space.reps.map((r) => [r.id, r])), [space.reps]);

  const filteredPeople = useMemo(() => {
    const q = peopleQuery.trim().toLowerCase();
    const list = space.contacts.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (q) {
        const comp = companyMap.get(p.companyId)?.name.toLowerCase() || '';
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.email.toLowerCase().includes(q) &&
          !comp.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'company')
        cmp = (companyMap.get(a.companyId)?.name || '').localeCompare(
          companyMap.get(b.companyId)?.name || ''
        );
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortKey === 'owner')
        cmp = (repMap.get(a.ownerId)?.name || '').localeCompare(repMap.get(b.ownerId)?.name || '');
      else cmp = a.lastTouch.localeCompare(b.lastTouch);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [space.contacts, statusFilter, peopleQuery, sortKey, sortDir, companyMap, repMap]);

  const filteredCompanies = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    if (!q) return space.companies;
    return space.companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
    );
  }, [space.companies, companyQuery]);

  const toggleSort = (key: PeopleSort) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'lastTouch' ? 'desc' : 'asc');
    }
  };

  return (
    <div>
      <div className="phead">
        <div>
          <AnimatedTitle text="Contacts" mark="amber" animKey={`${space.id}-ct`} />
          <p className="phead__sub">
            {space.contacts.length} people at {space.companies.length} companies
          </p>
        </div>

        <div className="phead__actions">
          <MagneticButton
            type="button"
            className="btn btn--primary"
            onClick={() => openModal({ kind: 'new-contact' })}
          >
            <IconPlus size={16} />
            <span>New contact</span>
          </MagneticButton>
        </div>
      </div>

      <SlidingTabs
        activeId={activeTab}
        onChange={(id) => {
          setTabDir(id === 'companies' ? 1 : -1);
          navigate('contacts', id);
        }}
        items={[
          { id: 'people', label: 'People', count: space.contacts.length },
          { id: 'companies', label: 'Companies', count: space.companies.length },
        ]}
      />

      <div ref={contentRef}>
        <SwapView swapKey={activeTab} direction={tabDir}>
          {activeTab === 'people' ? (
            <div>
              <div className="filter-bar">
                <div className="search-box">
                  <span className="search-box__icon">
                    <IconSearch size={15} />
                  </span>
                  <input
                    className="search-box__input"
                    placeholder="Name, email or company"
                    value={peopleQuery}
                    onChange={(e) => setPeopleQuery(e.target.value)}
                  />
                </div>

                <SlidingSeg
                  ariaLabel="Filter by status"
                  activeId={statusFilter}
                  onChange={setStatusFilter}
                  items={[
                    { id: 'all', label: 'All' },
                    { id: 'Customer', label: 'Customers' },
                    { id: 'Prospect', label: 'Prospects' },
                    { id: 'Cold', label: 'Cold' },
                  ]}
                />
              </div>

              <div className="card table-card">
                <table className="data-table">
                  <thead>
                    <tr>
                      {(
                        [
                          ['name', 'Name'],
                          ['company', 'Company'],
                          ['status', 'Status'],
                          ['owner', 'Owner'],
                          ['lastTouch', 'Last touch'],
                        ] as [PeopleSort, string][]
                      ).map(([key, label]) => (
                        <th key={key}>
                          <button type="button" className="sort-btn" onClick={() => toggleSort(key)}>
                            <span>{label}</span>
                            {sortKey === key && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPeople.map((person) => {
                      const comp = companyMap.get(person.companyId);
                      const owner = repMap.get(person.ownerId);
                      const pillTone =
                        person.status === 'Customer'
                          ? 'pill--lime'
                          : person.status === 'Prospect'
                            ? 'pill--sky'
                            : 'pill--muted';
                      return (
                        <tr
                          key={person.id}
                          onClick={() => openDrawer({ kind: 'contact', id: person.id })}
                        >
                          <td data-label="Name">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <ContactAvatar name={person.name} tone={person.tone} size={34} />
                              <div>
                                <div style={{ fontWeight: 700 }}>{person.name}</div>
                                <div style={{ fontSize: 12, color: 'var(--faint)' }}>
                                  {person.role}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td data-label="Company" style={{ color: 'var(--muted)' }}>
                            {comp?.name}
                          </td>
                          <td data-label="Status">
                            <span className={`pill ${pillTone}`}>{person.status}</span>
                          </td>
                          <td data-label="Owner">{owner?.name}</td>
                          <td data-label="Last touch" style={{ color: 'var(--muted)' }}>
                            {formatRelativeTouch(person.lastTouch)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div>
              <div className="filter-bar">
                <div className="search-box">
                  <span className="search-box__icon">
                    <IconSearch size={15} />
                  </span>
                  <input
                    className="search-box__input"
                    placeholder="Company, industry or city"
                    value={companyQuery}
                    onChange={(e) => setCompanyQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="company-grid">
                {filteredCompanies.map((comp) => {
                  const compDeals = space.deals.filter((d) => d.companyId === comp.id);
                  const openVal = compDeals
                    .filter((d) => OPEN_STAGES.includes(d.stage))
                    .reduce((s, d) => s + d.value, 0);
                  const wonVal = compDeals
                    .filter((d) => d.stage === 'won')
                    .reduce((s, d) => s + d.value, 0);
                  const compContacts = space.contacts.filter((p) => p.companyId === comp.id);

                  return (
                    <div key={comp.id} className="card company-card">
                      <div className="company-card__head">
                        <span className="company-mark">
                          <IconBuilding size={18} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{comp.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--faint)' }}>
                            {comp.industry} · {comp.city} · {comp.staff} staff
                          </div>
                        </div>
                      </div>

                      <div className="company-stats">
                        <div>
                          <div className="company-stats__label">Open</div>
                          <div className="company-stats__val">{formatKrCompact(openVal)}</div>
                        </div>
                        <div>
                          <div className="company-stats__label">Won</div>
                          <div className="company-stats__val">{formatKrCompact(wonVal)}</div>
                        </div>
                        <div>
                          <div className="company-stats__label">Deals</div>
                          <div className="company-stats__val">{compDeals.length}</div>
                        </div>
                      </div>

                      <div className="company-card__foot">
                        <div className="avatar-row">
                          {compContacts.slice(0, 4).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => openDrawer({ kind: 'contact', id: p.id })}
                              aria-label={p.name}
                            >
                              <ContactAvatar name={p.name} tone={p.tone} size={28} />
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="card__link"
                          style={{ color: 'var(--text)' }}
                          onClick={() =>
                            openModal({ kind: 'new-deal', defaultCompanyId: comp.id })
                          }
                        >
                          <IconPlus size={13} />
                          Deal
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SwapView>
      </div>
    </div>
  );
};
