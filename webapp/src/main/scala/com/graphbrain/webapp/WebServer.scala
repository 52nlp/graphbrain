package com.graphbrain.webapp

import java.io.{PrintWriter, BufferedWriter, FileWriter}
import java.util.Locale
import java.text.DateFormat
import java.net.URL

import unfiltered.request._
import unfiltered.response._
import unfiltered.Cookie
import org.fusesource.scalate.TemplateEngine
import akka.actor.ActorSystem
import akka.actor.Props

import com.graphbrain.db.Graph
import com.graphbrain.db.SimpleCaching
import com.graphbrain.db.UserOps
import com.graphbrain.db.UserManagement
import com.graphbrain.db.UserNode
import com.graphbrain.db.ConsensusActor

object WebServer {
  var http: unfiltered.netty.Http = null
  var prod: Boolean = false

  val graph = new Graph with SimpleCaching with UserOps with UserManagement

  val templateDirs = List(new java.io.File("/var/www/templates"))
  val scalateMode = "production"
  val engine = new TemplateEngine(templateDirs, scalateMode)

  val actorSystem = ActorSystem("actors")

  val consensusActor = actorSystem.actorOf(Props(new ConsensusActor(graph)))

  def scalateResponse(template: String, page: String, title: String, cookies: Map[String, Any], req: HttpRequest[Any], js: String="", html: String="") = {
    val userNode = getUser(cookies)
    val loggedIn = userNode != null
    if (prod) {
      Ok ~> Scalate(req, template, ("title", title), ("navBar", NavBar(userNode, page).html), ("cssAndJs", new CssAndJs().cssAndJs), ("loggedIn", loggedIn), ("js", js), ("html", html))(engine)
    }
    else {
      Ok ~> Scalate(req, template, ("title", title), ("navBar", NavBar(userNode, page).html), ("cssAndJs", new CssAndJs().cssAndJs), ("loggedIn", loggedIn), ("js", js), ("html", html))
    }
  }

  def realIp(req: HttpRequest[Any]) = {
    val headers = req.headers("X-Forwarded-For")
    if (headers.hasNext)
      headers.next()
    else
      req.remoteAddr
  }

  def getUser(cookies: Map[String, Any]): UserNode = {
    val username = cookies("username") match {
      case Some(Cookie(_, value, _, _, _, _, _, _)) => value
      case _ => null
    } 
    val session = cookies("session") match {
      case Some(Cookie(_, value, _, _, _, _, _, _)) => value
      case _ => null
    }
    if ((username == null) || (session == null)) {
      null
    }
    else {
      val userNode = graph.getUserNodeByUsername(username)
      if (userNode == null) {
        null
      }
      else {
        if (userNode.checkSession(session)) {
          userNode
        }
        else {
          null
        }
      }
    }
  }

  def log(req: HttpRequest[Any], cookies: Map[String, Any], msg: String) = {
    val df = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.MEDIUM, Locale.FRANCE)

    val out = new PrintWriter(new BufferedWriter(new FileWriter("webapp.log", true)))

    val ip = if (req == null) "" else realIp(req)
    val userNode = if (cookies == null) null else getUser(cookies)
    val username = if (userNode == null) "null" else userNode.username

    out.println("[" + df.format(new java.util.Date) + "] " + ip + " " + username + " - " + msg)
    out.close()
  }

  def start(prod: Boolean) = {
    log(null, null, "webserver started")

    this.prod = prod
    http = unfiltered.netty.Http(8080)
      .handler(GBPlan)
      .handler(LandingPlan)
      .handler(NodePlan)
      .handler(NodeActionsPlan)
      .handler(RelationsPlan)
      .handler(AIChatPlan)
      .handler(DisambigPlan)
      .handler(ContextsPlan)
      .resources(new URL(getClass.getResource("/robots.txt"), "."))
    http.run()

    actorSystem.shutdown()

    log(null, null, "webserver shutdown")
  }

  def main(args: Array[String]) {
    start((args.length > 0) && (args(0) == "prod"))
  }
}