package application.rest;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;

@Path("/")
public class RootEndpoint {

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response listResources(@Context UriInfo uriInfo) {
      String healthURL = (uriInfo.getAbsolutePath() + "/health").replaceAll("(?<!http:)\\/\\/", "/");
      String exampleURL = (uriInfo.getAbsolutePath() + "/v1/example").replaceAll("(?<!http:)\\/\\/", "/");
      return Response.ok("{\"health\":\""+healthURL+"\",\"example\":\""+exampleURL+"\"}").build();
    }

}
