
export function SettingsPanelHeader({action, body, icon: Icon, kicker, title}) {
    return (
        <header>
            <div className="settings-panel-title">
                <Icon size={17} />
                <span>
                    <p>{kicker}</p>
                    <h3>{title}</h3>
                    {body ? <small>{body}</small> : null}
                </span>
            </div>
            {action}
        </header>
    );
}

