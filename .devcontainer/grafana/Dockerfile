FROM grafana/grafana:10.4.1

USER root

# Copy dashboards into the container
COPY grafana-provisioning/dashboards/*.json /dashboards/
COPY grafana-provisioning/dashboards/default.yaml /etc/grafana/provisioning/dashboards/
COPY grafana-provisioning/datasources/*.yaml /etc/grafana/provisioning/datasources/

# Copy and set permissions for init script
COPY grafana-init.sh /usr/local/bin/grafana-init.sh
RUN chmod +x /usr/local/bin/grafana-init.sh

# Create startup script that runs Grafana and then imports dashboards
RUN echo '#!/bin/sh\n\
# Start Grafana in background\n\
/run.sh &\n\
GRAFANA_PID=$!\n\
\n\
# Run dashboard import script\n\
/usr/local/bin/grafana-init.sh\n\
\n\
# Keep Grafana running in foreground\n\
wait $GRAFANA_PID' > /startup.sh && chmod +x /startup.sh

USER grafana

ENTRYPOINT ["/startup.sh"]