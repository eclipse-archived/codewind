package application.rest;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Application;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

@Path("health")
public class HealthEndpoint {

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response healthcheck() {
      /*
      if (!healthy) {
        return Response.status(503).entity("{\"status\":\"DOWN\"}").build();
      }
      */
      return Response.ok("{\"status\":\"UP\"}").build();
    }

}
