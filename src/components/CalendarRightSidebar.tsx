import { useCallback } from 'react';
import { useServices } from '../context/ServicesContext';
import { runAsyncAction } from '../utils/async';
import { NotebookNavigatorView } from '../view/NotebookNavigatorView';
import { Calendar } from './calendar';

export function CalendarRightSidebar() {
    const { app, plugin } = useServices();

    const handleAddDateFilter = useCallback(
        (dateToken: string) => {
            runAsyncAction(async () => {
                let leaves = plugin.getNavigatorLeaves();
                let shouldRevealLeaf = true;
                if (leaves.length === 0) {
                    await plugin.activateView();
                    leaves = plugin.getNavigatorLeaves();
                    shouldRevealLeaf = false;
                }

                const navigatorLeaf = leaves[0];
                if (!navigatorLeaf) {
                    return;
                }

                const navigatorView = navigatorLeaf.view;
                if (!(navigatorView instanceof NotebookNavigatorView)) {
                    return;
                }

                navigatorView.addDateFilterToSearch(dateToken);
                if (shouldRevealLeaf) {
                    await app.workspace.revealLeaf(navigatorLeaf);
                }
            });
        },
        [app.workspace, plugin]
    );

    return (
        <div className="nn-calendar-right-sidebar nn-list-pane">
            <div className="nn-calendar-right-sidebar-content">
                <Calendar weeksToShowOverride={6} onAddDateFilter={handleAddDateFilter} isRightSidebar={true} />
            </div>
        </div>
    );
}
