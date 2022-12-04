import * as React from "react";
import { useEffect, useRef, useState } from "react";
import * as ReactDOM from "react-dom";
import * as SDK from "azure-devops-extension-sdk";
import { Dropdown } from "azure-devops-ui/Dropdown";
import { IListBoxItem } from "azure-devops-ui/ListBox";
import { CommonServiceIds, getClient, IProjectPageService } from "azure-devops-extension-api";
import { BuildDefinitionReference, BuildRestClient } from "azure-devops-extension-api/Build";

import "azure-devops-ui/Core/core.css";
import "azure-devops-ui/Core/override.css";
import './queue-time-dashboard-widget.scss';

const MaxItems = 20;
const MinHeight = 8;
const MaxHeight = 72;

// this should be imported from the widget SDK, but it's not available in the new version :(
interface EventArgs<T> {
    data: T;
}

export interface NotifyResult {
    getResponse(): Promise<string>;
}

interface IWidgetConfigurationContext {
    notify: <T>(event: string, eventArgs: EventArgs<T>) => Promise<NotifyResult>;
}

export const QueueTimeDashboardWidgetConfiguration = () => {
    const [definitions, setDefinitions] = useState<BuildDefinitionReference[]>([]);
    const [configurationContext, setConfigurationContext] = useState<IWidgetConfigurationContext>();

    // to avoid a stale closure in the functions passed to SDK.register, we use a ref instead of state
    // the Dropdown doesn't need it anyway
    const latestDefinitionId = useRef("");

    const loadDefinitions = async () => {
        const projectService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
        const project = await projectService.getProject();
        if (!project) {
            return;
        }

        const buildClient = getClient(BuildRestClient);
        
        const definitions = await buildClient.getDefinitions(project.id);
        setDefinitions(definitions);
    }

    const onHostLoad = (widgetSettings: any, widgetConfigurationContext: any) => {
        console.log("config widgetSettings " + JSON.stringify(widgetSettings));
        
        setConfigurationContext(widgetConfigurationContext);

        // in most samples this is
        //     return WidgetHelpers.WidgetStatusHelper.Sucess();
        // .. but the new SDK doesn't contain that at this time, or a way to include it e.g. VSS.require()
        return Promise.resolve({
            statusType: 0 // success
        });
    };

    const onHostSave = () => {
        // WidgetConfigurationSave.Valid (or .Invalid)
        return Promise.resolve({
            customSettings: {
                data: JSON.stringify({
                    definitionId: latestDefinitionId.current
                })
            },
            isValid: true 
        });
    };

    useEffect(() => {
        SDK.register("queue-time-dashboard-widget.configuration", () => {
            return {
                load: onHostLoad,
                onSave: onHostSave
            }
        });

        SDK.init({
            loaded: true
        });
        
        SDK.ready();

        loadDefinitions();
    }, []);

    const onSelectPipeline = (event: React.SyntheticEvent<HTMLElement>, item: IListBoxItem<{}>) => {
        // using a ref instead of state
        latestDefinitionId.current = item.id;

        if (!!configurationContext) {
            const customSettings = {
                data: JSON.stringify({
                    definitionId: item.id
                })
            };

            configurationContext.notify(
                "ms.vss-dashboards-web.configurationChange", // ConfigurationEvent.ConfigurationChange
                { data: customSettings } // ConfigurationEvent.Args(customSettings)
            );
        }
    };

    const pipelineItems: IListBoxItem[] = definitions.map((definition, index) => {
        return {
            id: definition.id.toString(),
            text: definition.name
        };
    });

    return (
        <div>
            <h3>Select a pipeline</h3>
            <Dropdown placeholder="Select a pipeline" items={pipelineItems} onSelect={onSelectPipeline} />
        </div>
    )
}

ReactDOM.render(<QueueTimeDashboardWidgetConfiguration />, document.getElementById("root"));